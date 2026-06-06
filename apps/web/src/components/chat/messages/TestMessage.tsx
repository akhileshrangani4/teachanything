"use client";

import { useEffect, useRef, useState } from "react";
import type { Test } from "@/lib/test-mode";
import type { TestQuestion } from "@/lib/questions";
import {
  computeGrade,
  PASS_THRESHOLD,
  buildOpenAnswerReviewMessage,
  type OpenAnswer,
} from "@/lib/grading";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, X, RotateCcw, Trophy, Clock } from "lucide-react";

interface TestMessageProps {
  test: Test;
  onSendText?: (text: string) => boolean;
}

/** Format a whole number of seconds as mm:ss. */
function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Soft ceiling for an open answer. Open questions target ~50-80 words; this is a
 * generous cap that only nudges (a warning, not a hard block) so a student who
 * over-writes still gets graded but is steered toward a focused response.
 */
const MAX_WORDS_PER_ANSWER = 500;

/** Count whitespace-separated words in a string. */
function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/** Has the student answered this question? MC needs a selection; open needs non-empty text. */
function isAnswered(question: TestQuestion, answer: string | null): boolean {
  if (question.type === "open") {
    return (answer ?? "").trim().length > 0;
  }
  return answer !== null;
}

export function TestMessage({ test, onSendText }: TestMessageProps) {
  const total = test.questions.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  // One answer per question, keyed by question index. For MC this stores the
  // chosen option; for open questions it stores the typed free-response text.
  // null until the student answers.
  const [answers, setAnswers] = useState<(string | null)[]>(() =>
    Array(total).fill(null),
  );
  const [finished, setFinished] = useState(false);

  // Guards the one-time auto-send of written answers for feedback. We only send
  // on the FIRST finish so a retake + re-finish does not re-post the message.
  const sentOpenAnswersRef = useRef(false);
  const [openAnswersSent, setOpenAnswersSent] = useState(false);

  // Count-up timer. Elapsed is derived from a stored start timestamp so it
  // stays accurate even when the tab is throttled in the background.
  const startedAtRef = useRef<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Frozen elapsed captured the moment the test is finished.
  const [finalElapsedSeconds, setFinalElapsedSeconds] = useState(0);

  useEffect(() => {
    if (finished) return; // freeze the timer once finished
    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [finished]);

  const question = test.questions[currentIndex];
  const answer = answers[currentIndex] ?? null;
  const answered = question ? isAnswered(question, answer) : false;
  const isLast = currentIndex === total - 1;

  // Only multiple-choice questions are auto-graded. Open questions are reviewed
  // by the AI in the chat stream, so they are excluded from the numeric grade.
  const mcTotal = test.questions.filter(
    (q) => q.type === "multiple_choice",
  ).length;
  const hasOpenQuestions = test.questions.some((q) => q.type === "open");
  // Whether AI feedback on written answers is even possible here. Public/embed
  // pages may not pass onSendText; in that case we must not promise "see the
  // chat" feedback that will never arrive.
  const canGradeWritten = onSendText !== undefined;
  const score = test.questions.reduce((acc, q, idx) => {
    if (q.type !== "multiple_choice") return acc;
    return answers[idx] !== null && answers[idx] === q.correct_answer
      ? acc + 1
      : acc;
  }, 0);

  const handleSelect = (option: string) => {
    if (!question || question.type !== "multiple_choice") return;
    if (answered) return; // lock MC answer once chosen
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = option;
      return next;
    });
  };

  const handleOpenChange = (text: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = text;
      return next;
    });
  };

  const finish = () => {
    setFinalElapsedSeconds(
      Math.floor((Date.now() - startedAtRef.current) / 1000),
    );
    setFinished(true);

    // Build and send the written-answer review message exactly once.
    if (sentOpenAnswersRef.current) return;
    const openAnswers: OpenAnswer[] = test.questions.flatMap((q, idx) =>
      q.type === "open"
        ? [{ question: q.question, answer: answers[idx] ?? "" }]
        : [],
    );
    const message = buildOpenAnswerReviewMessage(test.test_title, openAnswers);
    if (message && onSendText) {
      // Only mark as sent if the send was actually accepted. If a stream is
      // already in flight onSendText returns false (and toasts), so we leave
      // the guard down and let the next Finish re-attempt rather than silently
      // dropping the student's answers.
      const accepted = onSendText(message);
      if (accepted) {
        sentOpenAnswersRef.current = true;
        setOpenAnswersSent(true);
      }
    }
  };

  const handleNext = () => {
    if (isLast) {
      finish();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleRetake = () => {
    setAnswers(Array(total).fill(null));
    setCurrentIndex(0);
    setFinished(false);
    // Restart the timer from scratch.
    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setFinalElapsedSeconds(0);
    // Note: sentOpenAnswersRef stays true so a re-finish does not re-send.
  };

  // Schema guarantees at least one question, but the indexed access is
  // optional under strict settings -- guard so TS is satisfied.
  if (!question) return null;

  if (finished) {
    const grade = computeGrade(score, mcTotal);

    return (
      <Card className="bg-secondary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Trophy className="h-4 w-4 text-amber-500" aria-hidden="true" />
            {test.test_title}
          </CardTitle>
        </CardHeader>
        <CardContent
          className="flex flex-col gap-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-2 py-2">
            {mcTotal > 0 ? (
              <>
                <p className="text-3xl font-bold" aria-hidden="true">
                  {score}
                  <span className="text-muted-foreground text-xl">
                    {" "}
                    / {mcTotal}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Multiple choice: {score} / {mcTotal} · {grade.percentage}% ·
                  Grade: {grade.letter}
                </p>
                {grade.passed ? (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400">
                    <Trophy className="h-4 w-4" aria-hidden="true" />
                    Passed (≥{PASS_THRESHOLD}%)
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-400">
                    <X className="h-4 w-4" aria-hidden="true" />
                    Did not pass (need ≥{PASS_THRESHOLD}%)
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                {canGradeWritten
                  ? "This test has only written answers — see the chat for feedback."
                  : "This test has only written answers. Review them below against the suggested points."}
              </p>
            )}
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Finished in {formatElapsed(finalElapsedSeconds)}
            </p>
            {openAnswersSent ? (
              <p className="text-xs text-muted-foreground text-center">
                Your written answers were sent for feedback — see the chat
                below.
              </p>
            ) : (
              hasOpenQuestions &&
              !canGradeWritten && (
                <p className="text-xs text-muted-foreground text-center">
                  Written-answer feedback isn’t available here — compare your
                  answers with the suggested points below.
                </p>
              )
            )}
          </div>

          <TestReview test={test} answers={answers} />
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" onClick={handleRetake}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Retake test
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="bg-secondary">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base md:text-lg">
            {test.test_title}
          </CardTitle>
          <div className="flex items-center gap-3 whitespace-nowrap">
            <span
              className="flex items-center gap-1 text-xs text-muted-foreground"
              aria-label={`Elapsed time ${formatElapsed(elapsedSeconds)}`}
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatElapsed(elapsedSeconds)}
            </span>
            <span className="text-xs text-muted-foreground">
              Question {currentIndex + 1} of {total}
            </span>
          </div>
        </div>
        <Progress
          value={((currentIndex + 1) / total) * 100}
          className="h-2"
          aria-label={`Question ${currentIndex + 1} of ${total}`}
        />
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <p className="text-sm md:text-base font-medium">{question.question}</p>

        {question.type === "open" ? (
          <div className="flex flex-col gap-1.5">
            <Textarea
              value={answer ?? ""}
              onChange={(e) => handleOpenChange(e.target.value)}
              placeholder="Write your answer…"
              className="min-h-[120px] bg-background"
              aria-label={question.question}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Aim for 50–80 words.</span>
              <span
                aria-live="polite"
                className={cn(
                  countWords(answer ?? "") > MAX_WORDS_PER_ANSWER &&
                    "text-amber-600 dark:text-amber-500",
                )}
              >
                {countWords(answer ?? "")} word
                {countWords(answer ?? "") === 1 ? "" : "s"}
                {countWords(answer ?? "") > MAX_WORDS_PER_ANSWER &&
                  ` · recommended ≤ ${MAX_WORDS_PER_ANSWER}`}
              </span>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col gap-2"
            role="group"
            aria-label={question.question}
          >
            {question.options.map((option, optionIndex) => {
              const isCorrect = option === question.correct_answer;
              const isChosen = option === answer;
              const answerState =
                answered && isCorrect
                  ? " (correct answer)"
                  : answered && isChosen && !isCorrect
                    ? " (your answer, incorrect)"
                    : "";

              return (
                <button
                  // Composite key: schema doesn't guarantee unique option text.
                  key={`${optionIndex}-${option}`}
                  type="button"
                  onClick={() => handleSelect(option)}
                  disabled={answered}
                  aria-label={`${option}${answerState}`}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    "disabled:cursor-default",
                    !answered &&
                      "border-border/60 bg-background hover:bg-accent hover:text-accent-foreground",
                    answered &&
                      isCorrect &&
                      "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-400",
                    answered &&
                      isChosen &&
                      !isCorrect &&
                      "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-400",
                    answered &&
                      !isCorrect &&
                      !isChosen &&
                      "border-border/40 bg-background opacity-60",
                  )}
                >
                  <span>{option}</span>
                  {answered && isCorrect && (
                    <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  {answered && isChosen && !isCorrect && (
                    <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {question.type === "multiple_choice" && answered && (
          <div
            className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-xs md:text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <span className="font-medium text-foreground">
              {answer === question.correct_answer ? "Correct! " : "Not quite. "}
            </span>
            {question.explanation}
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-end">
        <Button size="sm" onClick={handleNext} disabled={!answered}>
          {isLast ? "Finish" : "Next"}
        </Button>
      </CardFooter>
    </Card>
  );
}

interface TestReviewProps {
  test: Test;
  answers: (string | null)[];
}

/** Per-question review list shown on the results screen. */
function TestReview({ test, answers }: TestReviewProps) {
  return (
    <div className="flex flex-col gap-4">
      {test.questions.map((question, idx) => {
        const answer = answers[idx] ?? null;

        return (
          <div key={idx} className="flex flex-col gap-2">
            <p className="text-sm md:text-base font-medium">
              <span className="text-muted-foreground">{idx + 1}. </span>
              {question.question}
            </p>

            {question.type === "open" ? (
              <>
                <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm whitespace-pre-wrap">
                  {answer && answer.trim().length > 0 ? (
                    answer
                  ) : (
                    <span className="text-muted-foreground italic">
                      No answer written.
                    </span>
                  )}
                </div>
                <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-xs md:text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">
                    What a strong answer covers:
                  </p>
                  {question.guidance}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2" role="group">
                  {question.options.map((option, optionIndex) => {
                    const isCorrect = option === question.correct_answer;
                    const isChosen = option === answer;
                    const answerState = isCorrect
                      ? " (correct answer)"
                      : isChosen && !isCorrect
                        ? " (your answer, incorrect)"
                        : "";

                    return (
                      <div
                        key={`${optionIndex}-${option}`}
                        aria-label={`${option}${answerState}`}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm",
                          isCorrect &&
                            "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-400",
                          isChosen &&
                            !isCorrect &&
                            "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-400",
                          !isCorrect &&
                            !isChosen &&
                            "border-border/40 bg-background opacity-60",
                        )}
                      >
                        <span>{option}</span>
                        {isCorrect && (
                          <Check
                            className="h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        {isChosen && !isCorrect && (
                          <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-xs md:text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {answer === question.correct_answer
                      ? "Correct! "
                      : "Not quite. "}
                  </span>
                  {question.explanation}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

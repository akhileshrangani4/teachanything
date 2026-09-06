/**
 * Extract the balanced span that starts at `start` (which must hold the opening
 * `{` or `[`). Returns the substring or null when the span never closes. Depth
 * counting skips brackets inside strings so a `}` or `]` in a question/option
 * can't end the span early.
 */
export function extractBalanced(text: string, start: number): string | null {
  const open = text[start];
  if (open !== "{" && open !== "[") return null;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Every complete `{...}` object inside the array that opens at `arrayStart`,
 * stopping at the first one that was cut off mid-write.
 *
 * Shared by both truncation salvages: a quiz the token limit interrupted arrives
 * either as JSON (`salvageTruncatedQuiz`) or as an unclosed pseudo-call
 * (`extractPseudoCall`), and in both shapes the questions that finished writing
 * are perfectly good.
 */
export function collectClosedObjects(
  text: string,
  arrayStart: number,
): unknown[] {
  const objects: unknown[] = [];
  let cursor = arrayStart + 1;
  for (;;) {
    const objectStart = text.indexOf("{", cursor);
    if (objectStart === -1) break;
    const object = extractBalanced(text, objectStart);
    if (!object) break; // the question that was cut off mid-write
    try {
      objects.push(JSON.parse(object));
    } catch {
      break;
    }
    cursor = objectStart + object.length;
  }
  return objects;
}

/**
 * Extract the first balanced top-level `{...}` object from free text, unwrapping
 * a leading ```json fence if present. Returns the JSON substring or null.
 */
export function extractJsonObject(raw: string): string | null {
  let text = raw;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1];
  const start = text.indexOf("{");
  if (start === -1) return null;
  return extractBalanced(text, start);
}

/**
 * Parse a `showQuiz` call the model wrote in its native pseudo-call syntax
 * instead of as a JSON object:
 *
 *   [showQuiz(quiz_title="Gender Quiz", questions=[ { "question": ... } ])]
 *
 * Llama-family models emit this shape when their tool-call channel isn't used,
 * so the whole call lands in the assistant text. Only the two keyword args are
 * read, in either order; the `questions` payload must be valid JSON (it is, in
 * practice -- these models serialize the array itself as JSON). Anything looser
 * is rejected rather than repaired, so ordinary prose can't be misread as a
 * quiz. Returns a candidate object for validation/repair, or null.
 *
 * A call the token limit cut off mid-write never closes its `questions` array.
 * Rather than discard a quiz that is almost entirely usable, keep the question
 * objects that finished -- the same salvage `salvageTruncatedQuiz` performs for
 * a truncated JSON leak.
 */
export function extractPseudoCall(raw: string): unknown | null {
  const call = raw.match(/showQuiz\s*\(/);
  if (call?.index === undefined) return null;
  const body = raw.slice(call.index + call[0].length);

  const title = body.match(/quiz_title\s*[=:]\s*("(?:[^"\\]|\\.)*")/);
  const questionsKey = body.match(/questions\s*[=:]\s*\[/);
  if (!title?.[1] || questionsKey?.index === undefined) return null;

  const arrayStart = questionsKey.index + questionsKey[0].length - 1;
  const array = extractBalanced(body, arrayStart);

  let questions: unknown;
  if (array) {
    try {
      questions = JSON.parse(array) as unknown;
    } catch {
      return null;
    }
  } else {
    const salvaged = collectClosedObjects(body, arrayStart);
    if (salvaged.length === 0) return null;
    questions = salvaged;
  }

  try {
    return { quiz_title: JSON.parse(title[1]) as string, questions };
  } catch {
    return null;
  }
}

/**
 * Salvage a quiz from tool input the model never finished writing. A low
 * `maxTokens` on the chatbot cuts generation off mid-JSON, which leaves either
 * an unparseable input string or (when the args were streamed) no tool call at
 * all -- both of which the student sees as a failure even though the questions
 * that did arrive are perfectly good.
 *
 * So take the title and every question object that closed, and drop the one that
 * was still being written. Requires the title to have arrived: it is normally
 * the first key, and inventing one would put words in the professor's mouth.
 */
export function salvageTruncatedQuiz(text: string): unknown | null {
  const title = text.match(/"quiz_title"\s*:\s*("(?:[^"\\]|\\.)*")/);
  const questionsKey = text.search(/"questions"\s*:\s*\[/);
  if (!title?.[1] || questionsKey === -1) return null;

  const questions = collectClosedObjects(text, text.indexOf("[", questionsKey));
  if (questions.length === 0) return null;

  try {
    return { quiz_title: JSON.parse(title[1]) as string, questions };
  } catch {
    return null;
  }
}

/** The first balanced `{...}` in `text`, JSON-parsed, or null. */
export function jsonCandidate(text: string): unknown | null {
  const candidate = extractJsonObject(text);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

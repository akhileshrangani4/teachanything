import { jest, describe, it, expect } from "@jest/globals";
import { deleteAllCrawlFileIds } from "@/server/routers/crawler/helpers";

function makeTx() {
  const whereStub = jest.fn(() => Promise.resolve(undefined));
  const tx = {
    delete: jest.fn(() => ({ where: whereStub })),
  };
  return { tx, whereStub };
}

describe("deleteAllCrawlFileIds", () => {
  it("no-ops on empty fileIds", async () => {
    const { tx } = makeTx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteAllCrawlFileIds(tx as any, []);
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("deletes all associations then userFiles", async () => {
    const { tx } = makeTx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteAllCrawlFileIds(tx as any, ["f1"]);
    expect(tx.delete).toHaveBeenCalledTimes(2);
  });
});

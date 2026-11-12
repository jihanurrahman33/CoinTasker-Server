const test = require("node:test");
const assert = require("node:assert/strict");
const { errorHandler, notFound } = require("../src/middleware/errorHandler");
const { HttpError } = require("../src/utils/httpError");

function fakeRes() {
  return {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
}

const req = { method: "GET", originalUrl: "/x" };

test("HttpError is rendered with its status and message", () => {
  const res = fakeRes();
  errorHandler(new HttpError(409, "conflict"), req, res, () => {});
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { message: "conflict" });
});

test("unexpected errors become a generic 500 without leaking details", (t) => {
  t.mock.method(console, "error", () => {});
  const res = fakeRes();
  errorHandler(new Error("db password is hunter2"), req, res, () => {});
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { message: "Internal server error" });
});

test("notFound answers 404", () => {
  const res = fakeRes();
  notFound(req, res);
  assert.equal(res.statusCode, 404);
});

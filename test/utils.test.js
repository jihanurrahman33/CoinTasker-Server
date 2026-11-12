const test = require("node:test");
const assert = require("node:assert/strict");
const { isPositiveInteger, isPositiveNumber, omit } = require("../src/utils/validate");
const { parseObjectId } = require("../src/utils/objectId");
const { HttpError } = require("../src/utils/httpError");

test("isPositiveNumber accepts only finite numbers above zero", () => {
  assert.equal(isPositiveNumber(1.5), true);
  for (const bad of [0, -1, NaN, Infinity, "5", null, undefined]) {
    assert.equal(isPositiveNumber(bad), false);
  }
});

test("isPositiveInteger rejects fractions, zero and strings", () => {
  assert.equal(isPositiveInteger(3), true);
  for (const bad of [0, 1.5, -2, "3"]) {
    assert.equal(isPositiveInteger(bad), false);
  }
});

test("omit returns a copy without the listed keys", () => {
  const source = { a: 1, b: 2, c: 3 };
  const result = omit(source, ["b"]);
  assert.deepEqual(result, { a: 1, c: 3 });
  assert.deepEqual(source, { a: 1, b: 2, c: 3 });
});

test("parseObjectId returns an ObjectId for a valid hex id", () => {
  const id = parseObjectId("64b7f0c2a1b2c3d4e5f60718");
  assert.equal(id.toString(), "64b7f0c2a1b2c3d4e5f60718");
});

test("parseObjectId throws a 400 HttpError for malformed input", () => {
  for (const bad of ["nope", "", undefined, 123, {}]) {
    assert.throws(
      () => parseObjectId(bad),
      (error) => error instanceof HttpError && error.status === 400
    );
  }
});

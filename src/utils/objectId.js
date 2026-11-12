const { ObjectId } = require("mongodb");
const { HttpError } = require("./httpError");

/** Parses a Mongo ObjectId from user input, answering 400 instead of crashing. */
function parseObjectId(value) {
  if (typeof value !== "string" || !ObjectId.isValid(value)) {
    throw new HttpError(400, "Invalid id");
  }
  return new ObjectId(value);
}

module.exports = { parseObjectId };

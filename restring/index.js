const _ = require("lodash");

exports.handler = async (event, context) => {
  if (!event.string) {
    return {
      type: 0,
      missing: { string: "Send me a string, please." },
    };
  }

  const reversed = _.reverse(event.string.split("")).join("");
  return { type: 1, msg: "I reversed it for you!", data: reversed };
};

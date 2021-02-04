const _ = require("lodash");

const sampleLodash = (array) => {
  return _.chain(array)
    .map((item) => item * 10)
    .map((item) => [item, item * 2])
    .values();
};

exports.handler = async (event, context) => {
  if (!event.numbers || event.numbers.length < 1) {
    return {
      type: 0,
      msg: "GIMME YOUR NUMBERS! (No input array of numbers received)",
    };
  }

  const data = event.numbers;

  if (!_.every(data, Number)) {
    return {
      type: 0,
      msg: "All values must be valid numbers.",
    };
  }

  const dataProcessed = sampleLodash(data);

  return {
    type: 1,
    msg: "Funny things with numbers!",
    data: { in: data, out: dataProcessed },
  };
};

exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      type: 1,
      msg: `Hello from ${process.env.currentStage} stage!`,
    }),
  };
};

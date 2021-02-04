exports.handler = async (event, context) => {
  const msg = `What do you want? I'm busy doing nothing here!!! You tried to bother me on ${new Date().toLocaleTimeString()}`;

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({ type: 0, msg }),
  };
};

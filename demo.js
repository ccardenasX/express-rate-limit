"use strict";
const express = require("express");
const rateLimit = require("./lib/express-rate-limit.js");
const app = express();
const rt = rateLimit({
  domainOptions: [
    {
      domain: "call-nic.com",
      options: {
        max: 10,
        windowMs: 5000,
      },
    },
    {
      domain: "*",
      options: {
        max: 1,
        windowMs: 60 * 1000,
      },
    },
  ],
  //skipSuccessfulRequests: true,
  handler: function (req, res) {
    console.log("-------------------------------------");
    const exception = new Error();
    exception.code = 429;
    exception.message = "Too many requests";
    //throw exception;
    res.status(exception.code).send(exception.message);
  },
});
app.use(rt);
app.all("/", (req, res) => {
  //rt.resetIp("*", "::ffff:127.0.0.1");
  res.send("hello");
  console.log(req.ip);
});

app.listen(3000, () => {
  console.info("Server Running " + 3000);
});

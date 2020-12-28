"use strict";
const MemoryStore = require("./memory-store");

function RateLimit(options) {
  options = Object.assign(
    {
      message: "Too many requests, please try again later.",
      statusCode: 429, // 429 status = Too Many Requests (RFC 6585)
      headers: true, //Send custom rate limit header with limit and remaining
      draft_polli_ratelimit_headers: false, //Support for the new RateLimit standardization headers
      skipFailedRequests: false, // Do not count failed requests (status >= 400)
      skipSuccessfulRequests: false, // Do not count successful requests (status < 400
      domainOptions: [
        {
          domain: "*",
          options: {
            windowMs: 60 * 1000, // milliseconds - how long to keep records of requests in memory
            max: 5, // max number of recent connections during `window` milliseconds before sending a 429 response
          },
        },
      ],
      // allows to create custom keys (by default user IP is used)
      keyGenerator: function (req /*, res*/) {
        return req.ip;
      },
      skip: function (/*req, res*/) {
        return false;
      },
      handler: function (req, res /*, next*/) {
        res.status(options.statusCode).send(options.message);
      },
      onLimitReached: function (/*req, res, optionsUsed*/) {},

      store: [],
    },
    options
  );
  // store to use for persisting rate limit data, one for each domain
  let tmpCount = 0;
  options.domainOptions.forEach(function (opt) {
    options.store.push({
      domain: opt.domain,
      memStore: new MemoryStore(opt.options.windowMs),
    });

    if (
      typeof options.store[tmpCount].memStore.incr !== "function" ||
      typeof options.store[tmpCount].memStore.resetKey !== "function" ||
      (options.skipFailedRequests &&
        typeof options.store[tmpCount].memStore.decrement !== "function")
    ) {
      throw new Error("The store is not valid.");
    }
    tmpCount++;
  });

  function rateLimit(req, res, next) {
    Promise.resolve(options.skip(req, res))
      .then((skip) => {
        if (skip) {
          return next();
        }
        const domain = req.header("Origin") || req.header("Referer") || "*";
        const key = options.keyGenerator(req, res);
        let index = options.domainOptions.findIndex((i) => i.domain === domain);
        if (index === -1) {
          index = options.domainOptions.findIndex((i) => i.domain === "*");
        }
        options.store[index].memStore.incr(key, function (
          err,
          current,
          resetTime
        ) {
          if (err) {
            return next(err);
          }

          const maxResult =
            typeof options.domainOptions[index].options.max === "function"
              ? options.domainOptions[index].options.max(req, res)
              : options.domainOptions[index].options.max;

          Promise.resolve(maxResult)
            .then((max) => {
              req.rateLimit = {
                limit: max,
                current: current,
                remaining: Math.max(max - current, 0),
                resetTime: resetTime,
              };

              if (options.headers && !res.headersSent) {
                res.setHeader("X-RateLimit-Limit", max);
                res.setHeader("X-RateLimit-Remaining", req.rateLimit.remaining);
                if (resetTime instanceof Date) {
                  // if we have a resetTime, also provide the current date to help avoid issues with incorrect clocks
                  res.setHeader("Date", new Date().toGMTString());
                  res.setHeader(
                    "X-RateLimit-Reset",
                    Math.ceil(resetTime.getTime() / 1000)
                  );
                }
              }
              if (options.draft_polli_ratelimit_headers && !res.headersSent) {
                res.setHeader("RateLimit-Limit", max);
                res.setHeader("RateLimit-Remaining", req.rateLimit.remaining);
                if (resetTime) {
                  const deltaSeconds = Math.ceil(
                    (resetTime.getTime() - Date.now()) / 1000
                  );
                  res.setHeader("RateLimit-Reset", Math.max(0, deltaSeconds));
                }
              }

              if (
                options.skipFailedRequests ||
                options.skipSuccessfulRequests
              ) {
                let decremented = false;
                const decrementKey = () => {
                  if (!decremented) {
                    options.store[index].memStore.decrement(key);
                    decremented = true;
                  }
                };

                if (options.skipFailedRequests) {
                  res.on("finish", function () {
                    if (res.statusCode >= 400) {
                      decrementKey();
                    }
                  });

                  res.on("close", () => {
                    if (!res.finished) {
                      decrementKey();
                    }
                  });

                  res.on("error", () => decrementKey());
                }

                if (options.skipSuccessfulRequests) {
                  res.on("finish", function () {
                    if (res.statusCode < 400) {
                      options.store[index].memStore.decrement(key);
                    }
                  });
                }
              }

              if (max && current === max + 1) {
                options.onLimitReached(req, res, options);
              }

              if (max && current > max) {
                if (options.headers && !res.headersSent) {
                  res.setHeader(
                    "Retry-After",
                    Math.ceil(
                      options.domainOptions[index].options.windowMs / 1000
                    )
                  );
                }
                return options.handler(req, res, next);
              }

              next();
            })
            .catch(next);
        });
      })
      .catch(next);
  }
  rateLimit.resetKey = function (domain, key) {
    const index = options.store.findIndex((i) => i.domain === domain);
    if (index == -1) {
      throw new Error("The domain is invalid.");
    }
    options.store[index].memStore.resetKey(key);
  };
  //console.log(rateLimit.resetKey[0].resetKey.toString());
  //rateLimit.resetKey = options.store[0].memStore.resetKey.bind(options.store[0]);

  // Backward compatibility function
  //rateLimit.resetIp = rateLimit.resetKey;
  rateLimit.resetIp = function (domain, ip) {
    //console.log("domain");

    // const index = options.store.findIndex((i) => i.domain === domain);
    // if (index == -1) {
    //   console.log("errr-------------" + domain);
    //   throw new Error("The domain is invalid.");
    // }
    // console.log("asdas-------------" + index);
    rateLimit.resetKey(domain, ip);
  };
  return rateLimit;
}

module.exports = RateLimit;

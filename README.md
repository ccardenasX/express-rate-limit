# Express Rate Limit MultiDomain



Basic rate-limiting middleware for Express. Use to limit repeated requests to public APIs and/or endpoints such as password reset.

Plays nice with [express-slow-down](https://www.npmjs.com/package/express-slow-down).

Note: this module does not share state with other processes/servers by default. It also buckets all requests to an internal clock rather than starting a new timer for each end-user. 


## Install


$ se debe incluir la liberia  con import require o include
```js
const rateLimit = require("..express-rate-limit/express-rate-limit.js");
```


## Usage

For an API-only server where the rate-limiter should be applied to all requests:

```js
const rateLimit = require("..express-rate-limit/express-rate-limit.js");

// Enable if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
// see https://expressjs.com/en/guide/behind-proxies.html
// app.set('trust proxy', 1);

const limiter = rateLimit({
  domainOptions:[
    domain:'XXX.com', //domain setting
    options: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  ]
  
});

//  apply to all requests
app.use(limiter);
```


## License
Basado en el trabajo de 
MIT © [Nathan Friedly](http://nfriedly.com/)

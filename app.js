const express = require("express"); // web framework for Node.js
const morgan = require("morgan"); // HTTP request logger middleware for node.js
const cors = require("cors"); /* CORS is a node.js package for providing a Connect/Express middleware that can be used to enable CORS with various options.*/



const rateLimit = require("express-rate-limit"); /* Basic rate-limiting middleware for Express. Use to limit repeated requests to public APIs and/or endpoints such as password reset.*/
const helmet = require("helmet"); /*Helmet helps you secure your Express apps by setting various HTTP headers. It's not a silver bullet, but it can help! */
const mongoSanitize = require("express-mongo-sanitize");
const bodyParser = require("body-parser");  // Node.js body parsing middleware.

// const xss = require("xss"); /* Node.js Connect middleware to sanitize user input coming from POST body, GET queries, and url params. */

const app = express();


app.use(
  cors({
    origin: "*",

    methods: ["GET", "PATCH", "POST", "DELETE", "PUT"],

    credentials: true, //

    /*   Access-Control-Allow-Credentials is a header that, when set to true , tells browsers to expose the response to the frontend JavaScript code. The credentials consist of cookies, authorization headers, and TLS client certificates.*/
  })
);


// Setup express response and body parser configurations
app.use(express.json({ limit: "10kb" })); /* Controls the maximum request body size. If this is a number, then the value specifies the number of bytes; if it is a string, the value is passed to the bytes library for parsing. Defaults to '100kb'. */
app.use(bodyParser.json()); // Returns middleware that only parses json
app.use(bodyParser.urlencoded({ extended: true })); // Returns middleware that only parses urlencoded bodies

app.use(helmet());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

const limiter = rateLimit({
  max: 3000,
  windowMs: 60 * 60 * 1000, // In one hour
  message: "Too many Requests from this IP, please try again in an hour!",
});

app.use("/messageMe", limiter);

app.use(
  express.urlencoded({
    extended: true,
  })
); // Returns middleware that only parses urlencoded bodies

app.use(mongoSanitize());

// app.use(xss());

module.exports = app;

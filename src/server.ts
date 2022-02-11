import Fastify from "fastify";
import "dotenv/config";

import { getOrdersByToken } from "./routes";

const server = Fastify({ logger: false });

// @ts-expect-error
if (!globalThis.fetch) {
	require("isomorphic-fetch");

	// @ts-expect-error
	if (!globalThis.AbortController) {
		// @ts-expect-error
		globalThis.AbortController = require("abort-controller");
	}
}

server.register(getOrdersByToken);

server.listen(3000, (err, address) => {
	if (err) {
		server.log.error(err);
		process.exit(1);
	}
});

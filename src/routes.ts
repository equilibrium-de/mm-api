import { FastifyInstance, RouteShorthandOptions } from "fastify";
import { assetFromToken } from "@equilab/api";
import { switchMap } from "rxjs";
import {
	getOrders,
	getBestPrices,
	getTrades,
	createLimitOrder,
	createMarketOrder,
} from "./api";

export const getOrdersByToken = async (
	server: FastifyInstance,
	options: RouteShorthandOptions
) => {
	server.get("/orders/:token", async (request, response) => {
		// @ts-expect-error
		const token = request.params.token;

		// TODO: mb we should whitelist tokens
		if (typeof token !== "string") {
			response.status(422).send(new Error("Wrong token in request"));
		}

		return await getOrders(token);
	});

	server.get("/bestPrices/:token", async (request, response) => {
		// @ts-expect-error
		const token = request.params.token;

		// TODO: mb we should whitelist tokens
		if (typeof token !== "string") {
			response.status(422).send(new Error("Wrong token in request"));
		}

		return await getBestPrices(token);
	});

	server.get("/trades/:token", async (request, response) => {
		// @ts-expect-error
		const token = request.params.token;

		// TODO: mb we should whitelist tokens
		if (typeof token !== "string") {
			response.status(422).send(new Error("Wrong token in request"));
		}

		return await getTrades(token);
	});

	server.get("/tradesByAcc/:token/:acc", async (request, response) => {
		// @ts-expect-error
		const { token, acc } = request.params;

		// TODO: mb we should whitelist tokens
		if (typeof token !== "string" || typeof acc !== "string") {
			response.status(422).send(new Error("Wrong token in request"));
		}

		return await getTrades(token, acc);
	});

	server.post("/limitOrder", async (request, response) => {
		// @ts-expect-error
		const { token, amount, limitPrice, direction, address } = request.body;

		if (
			typeof address !== "string" ||
			typeof token !== "string" ||
			typeof amount !== "number" ||
			typeof limitPrice !== "number" ||
			!["Buy", "Sell"].includes(direction)
		) {
			response.status(422).send(new Error("Wrong parameters in request body"));
		}

		return await createLimitOrder({
			token,
			amount,
			limitPrice,
			direction,
			address,
		});
	});

	server.post("/marketOrder", async (request, response) => {
		// @ts-expect-error
		const { token, amount, limitPrice, direction, address } = request.body;

		if (
			typeof address !== "string" ||
			typeof token !== "string" ||
			typeof amount !== "number" ||
			!["Buy", "Sell"].includes(direction)
		) {
			response.status(422).send(new Error("Wrong parameters in request body"));
		}

		return await createMarketOrder({
			token,
			amount,
			direction,
			address,
		});
	});
};

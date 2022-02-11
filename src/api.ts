import { assetFromToken, getApiCreator } from "@equilab/api";
import { switchMap, Observable, catchError, of, filter } from "rxjs";
import { fromFetch } from "rxjs/fetch";
import fetch from "node-fetch";
import qs from "querystring";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import Keyring from "@polkadot/keyring";
import fs from "fs";
import { isChainInfoResponse, isSeedPhrases } from "./types";
import {
	API_ENDPOINT,
	CHAIN_NODE,
	PRICE_PRECISION,
	AMOUNT_PRECISION,
} from "./constants";
import { promisify, handleTx } from "./utils";

const api$ = getApiCreator("Gens", "rxjs")(CHAIN_NODE);
let chainId: number | undefined = undefined;
let keyring: Keyring | undefined = undefined;
const orderObservables = new Map<string, Observable<unknown>>();
const bestPricesObservables = new Map<string, Observable<unknown>>();

const SEED_PHRASES = JSON.parse(fs.readFileSync("./seeds.json", "utf-8"));

if (!isSeedPhrases(SEED_PHRASES)) {
	console.error("Failed to initialize seed phrases from config");
	process.exit();
}

console.info("Initializing keyring...");
cryptoWaitReady()
	.then(() => {
		keyring = new Keyring();
		SEED_PHRASES.forEach((seed) =>
			keyring!.addFromMnemonic(seed, {}, "sr25519")
		);

		console.info("Keyring initialized");

		keyring.pairs.forEach((pair) => {
			console.info("Address added", pair.address);
		});
	})
	.catch((e) => {
		console.error("Failed to initialize keyring. Shutting down", e);
		process.exit();
	});

const genesis$ = api$.pipe(
	switchMap((api) => api.getBlockHash(0)),
	switchMap((hash) =>
		fromFetch(`${API_ENDPOINT}/chains/byHash?hash=${hash.toHex()}`).pipe(
			switchMap((response) => {
				if (response.ok) {
					return response.json();
				} else {
					return of({ error: true, message: `Error ${response.status}` });
				}
			}),
			catchError((err) => {
				return of({ error: true, message: err.message });
			})
		)
	)
);

const genesisSubscription = genesis$.subscribe({
	next: (res) => {
		if (!isChainInfoResponse(res)) return;

		chainId = res.chainId;

		console.info("Chain id initialized: ", chainId);
		genesisSubscription.unsubscribe();
	},
});

const getOrders$ = (token: string): Observable<unknown> => {
	if (orderObservables.has(token)) {
		return orderObservables.get(token)!;
	}

	const order$ = api$.pipe(switchMap((api) => api.derive.dex.orders(token)));
	orderObservables.set(token, order$);

	return order$;
};

export const getOrders = (token: string) => promisify(getOrders$(token));

const getBestPrices$ = (token: string): Observable<unknown> => {
	if (bestPricesObservables.has(token)) {
		return bestPricesObservables.get(token)!;
	}

	const bestPrices$ = api$.pipe(
		switchMap((api) => api.derive.dex.bestPrice(token))
	);

	bestPricesObservables.set(token, bestPrices$);

	return bestPrices$;
};

export const getBestPrices = (token: string) =>
	promisify(getBestPrices$(token));

export const getTrades = async (
	currency: string,
	acc: string | undefined = undefined,
	page: number = 0,
	pageSize: number = 10000
) => {
	if (!chainId) return undefined;

	const url = `${API_ENDPOINT}/dex/exchanges?${qs.stringify({
		acc,
		chainId,
		currency,
		page,
		pageSize,
	})}`;

	const response = await fetch(url);

	return await response.json();
};

export const createLimitOrder = ({
	token,
	amount,
	limitPrice,
	direction,
	address,
}: {
	token: string;
	amount: number | string;
	limitPrice: number | string;
	direction: "Buy" | "Sell";
	address: string;
}) => {
	const createOrderAsset = assetFromToken(token);
	const createOrderlimitPrice = PRICE_PRECISION.times(limitPrice).toString();
	const createOrderDirection = direction;
	const createOrderAmount = AMOUNT_PRECISION.times(amount).toString();

	const pair = keyring?.getPair(address);

	if (!pair) return Promise.reject("Address not found in keyring");

	const createOrder$ = api$.pipe(
		switchMap((api) =>
			api.tx
				.dexCreateOrder(
					createOrderAsset,
					{ Limit: { price: createOrderlimitPrice, expiration_time: 0 } },
					createOrderDirection,
					createOrderAmount
				)
				.signAndSend(pair, {
					nonce: -1,
				})
				.pipe(
					filter((res) => res.isFinalized || res.isInBlock),
					handleTx(api._api)
				)
		)
	);

	return promisify(createOrder$);
};

export const createMarketOrder = ({
	token,
	amount,
	direction,
	address,
}: {
	token: string;
	amount: number | string;
	direction: "Buy" | "Sell";
	address: string;
}) => {
	const createOrderAsset = assetFromToken(token);
	const createOrderDirection = direction;
	const createOrderAmount = AMOUNT_PRECISION.times(amount).toString();

	const pair = keyring?.getPair(address);

	if (!pair) return Promise.reject("Address not found in keyring");

	const createOrder$ = api$.pipe(
		switchMap((api) =>
			api.tx
				.dexCreateOrder(
					createOrderAsset,
					{ Market: {} },
					createOrderDirection,
					createOrderAmount
				)
				.signAndSend(pair, {
					nonce: -1,
				})
				.pipe(
					filter((res) => res.isFinalized || res.isInBlock),
					handleTx(api._api)
				)
		)
	);

	return promisify(createOrder$);
};

const animalBodyJsonSchema = {
	type: "object",
	required: ["animal"],
	properties: {
		animal: { type: "string" },
	},
};

const schema = {
	body: animalBodyJsonSchema,
};

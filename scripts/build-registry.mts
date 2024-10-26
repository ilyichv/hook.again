// @sts-nocheck
import { promises as fs } from "fs";
import { tmpdir } from "os";
import path from "path";
import { rimraf } from "rimraf";
import { Project, ScriptKind, SyntaxKind } from "ts-morph";
import type { z } from "zod";

import { registry } from "../registry";
import {
	type Registry,
	registryEntrySchema,
	type registryItemTypeSchema,
	registrySchema,
} from "../registry/schema";

const REGISTRY_PATH = path.join(process.cwd(), "public/r");

const REGISTRY_INDEX_WHITELIST: z.infer<typeof registryItemTypeSchema>[] = [
	"registry:hook",
];

const project = new Project({
	compilerOptions: {},
});

async function createTempSourceFile(filename: string) {
	const dir = await fs.mkdtemp(path.join(tmpdir(), "shadcn-"));
	return path.join(dir, filename);
}

// ----------------------------------------------------------------------------
// Build __registry__/index.tsx.
// ----------------------------------------------------------------------------
async function buildRegistry(registry: Registry) {
	let index = `// @ts-nocheck
// This file is autogenerated by scripts/build-registry.ts
// Do not edit this file directly.
import * as React from "react"

export const Index: Record<string, any> = {`;

	for (const item of registry) {
		const resolveFiles = item.files?.map(
			(file) => `registry/${typeof file === "string" ? file : file.path}`,
		);
		if (!resolveFiles) {
			continue;
		}

		const type = item.type.split(":")[1];
		const sourceFilename = "";

		const chunks: any = [];

		let componentPath = `@/registry/${type}/${item.name}`;

		if (item.files) {
			const files = item.files.map((file) =>
				typeof file === "string" ? { type: "registry:page", path: file } : file,
			);
			if (files?.length) {
				componentPath = `@/registry/${files[0].path}`;
			}
		}

		index += `
    "${item.name}": {
      name: "${item.name}",
      description: "${item.description ?? ""}",
      type: "${item.type}",
      registryDependencies: ${JSON.stringify(item.registryDependencies)},
      files: [${resolveFiles.map((file) => `"${file}"`)}],
      component: React.lazy(() => import("${componentPath}")),
      source: "${sourceFilename}",
      category: "${item.category ?? ""}",
      subcategory: "${item.subcategory ?? ""}",
      chunks: [${chunks.map(
				(chunk) => `{
        name: "${chunk.name}",
        description: "${chunk.description ?? "No description"}",
        component: ${chunk.component}
        file: "${chunk.file}",
        container: {
          className: "${chunk.container.className}"
        }
      }`,
			)}]
    },`;
	}

	index += `
}`;

	// ----------------------------------------------------------------------------
	// Build registry/index.json.
	// ----------------------------------------------------------------------------
	const items = registry
		.filter((item) => ["registry:hook"].includes(item.type))
		.map((item) => {
			return {
				...item,
				files: item.files?.map((_file) => {
					const file =
						typeof _file === "string"
							? {
									path: _file,
									type: item.type,
								}
							: _file;

					return file;
				}),
			};
		});
	const registryJson = JSON.stringify(items, null, 2);
	rimraf.sync(path.join(REGISTRY_PATH, "index.json"));
	await fs.writeFile(
		path.join(REGISTRY_PATH, "index.json"),
		registryJson,
		"utf8",
	);

	// Write style index.
	rimraf.sync(path.join(process.cwd(), "__registry__/index.tsx"));
	await fs.writeFile(path.join(process.cwd(), "__registry__/index.tsx"), index);
}

// ----------------------------------------------------------------------------
// Build registry/styles/[style]/[name].json.
// ----------------------------------------------------------------------------
async function buildStyles(registry: Registry) {
	for (const item of registry) {
		if (!REGISTRY_INDEX_WHITELIST.includes(item.type)) {
			continue;
		}

		let files;
		if (item.files) {
			files = await Promise.all(
				item.files.map(async (_file) => {
					const file =
						typeof _file === "string"
							? {
									path: _file,
									type: item.type,
									content: "",
									target: "",
								}
							: _file;

					let content: string;
					try {
						content = await fs.readFile(
							path.join(process.cwd(), "registry", file.path),
							"utf8",
						);
					} catch (error) {
						return;
					}

					const tempFile = await createTempSourceFile(file.path);
					const sourceFile = project.createSourceFile(tempFile, content, {
						scriptKind: ScriptKind.TSX,
					});

					sourceFile.getVariableDeclaration("iframeHeight")?.remove();
					sourceFile.getVariableDeclaration("containerClassName")?.remove();
					sourceFile.getVariableDeclaration("description")?.remove();

					let target = file.target;

					if ((!target || target === "") && item.name.startsWith("v0-")) {
						const fileName = file.path.split("/").pop();

						if (file.type === "registry:hook") {
							target = `hooks/${fileName}`;
						}
					}

					return {
						path: file.path,
						type: file.type,
						content: sourceFile.getText(),
						target,
					};
				}),
			);
		}

		const payload = registryEntrySchema
			.omit({
				source: true,
				category: true,
				subcategory: true,
				chunks: true,
			})
			.safeParse({
				...item,
				files,
			});

		if (payload.success) {
			await fs.writeFile(
				path.join(REGISTRY_PATH, `${item.name}.json`),
				JSON.stringify(payload.data, null, 2),
				"utf8",
			);
		}
	}
}

try {
	const result = registrySchema.safeParse(registry);

	if (!result.success) {
		console.error(result.error);
		process.exit(1);
	}

	await buildRegistry(result.data);
	await buildStyles(result.data);

	console.log("✅ Done!");
} catch (error) {
	console.error(error);
	process.exit(1);
}

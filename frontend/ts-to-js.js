#!/usr/bin/env node
import { readFiles } from "node-dir";
import { readFile, writeFile, rename } from "fs";
import { parse, print } from "recast";
import { transformFromAstSync } from "@babel/core";
import transformTypescript from "@babel/plugin-transform-typescript";
import getBabelOptions from "recast/parsers/_babel_options.js";
import { parser } from "recast/parsers/babel.js";

function to_js(content) {
    try {
        const ast = parse(content, {
            parser: {
                parse: (source, options) => {
                    const babelOptions = getBabelOptions.default(options);
                    babelOptions.plugins.push("typescript", "jsx");
                    return parser.parse(source, babelOptions);
                },
            },
        });

        const options = {
            cloneInputAst: false,
            code: false,
            ast: true,
            plugins: [transformTypescript],
            configFile: false,
        };
        const { ast: transformedAST } = transformFromAstSync(
            ast,
            content,
            options
        );
        const result = print(transformedAST).code;

        return result;
    } catch (e) {
        console.log(e);
        throw new Error(e.message);
    }
}

function modifyIndex() {
    readFile('index.html', 'utf8', function (err, data) {
        const content = data.replace(/main\.tsx/g, "main.jsx")
        writeFile('index.html', content, err => {
            if (err) {
            console.error(err);
            }
        });
    });
}

function convert() {
    const __dirname = ".";
    console.log("Transforming files...");
    readFiles(
        __dirname,
        {
            excludeDir: ["node_modules"],
            match: /\.tsx?$/,
        },
        function (err, content, filename, next) {
            if (err) throw err;
            const new_content = to_js(content);

            writeFile(filename, new_content, (err) => {
                if (err) {
                    console.error(err);
                }
            });

            next();
        },
        function (err, files) {
            if (err) throw err;
            console.log("Finished transforming files:", files);
            console.log("Changing Extensions...");
            for(const file of files) {
                rename(file, file.replace(/(\.ts)$/i, ".js").replace(/(\.tsx)$/i, ".jsx"), function(err) {
                    if ( err ) console.log('ERROR Renaming: ' + err);
                });
            }
            console.log("Finished changing Extensions...");
        }
    );
    modifyIndex();
}

convert();
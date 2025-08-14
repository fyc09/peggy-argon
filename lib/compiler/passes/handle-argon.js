// @ts-nocheck
"use strict";

const visitor = require("../visitor");
/** @type {PEG.Pass} */
function handleArgon(ast, options, session) {
  if (options.argon) {
    const replaceLabels = visitor.build({
      labeled(/** @type {PEG.ast.Labeled} */ node, env) {
        this._labeled(node, env);
        if (node.pick) {
          delete node.pick;
        }
        if (!node.label) {
          return;
        }
        if (
          node.label.startsWith("argon$")
          && !node.label.startsWith("argon$$")
        ) {
          session.info(
            `Applying argon label: ${node.label} -> ${node.label.slice(6)}`
          );
          session.info(`Starting expression: ${JSON.stringify(node, null, 2)}`);
          node.label = node.label.slice(6);
          const expr = node.expression;
          node.expression = {
            type: "action",
            expression: {
              type: "labeled",
              label: "value",
              labelLocation: expr.location,
              expression: expr,
              location: expr.location,
            },
            code: `/* argon */ return {value, name: "${node.label}"};`,
            location: expr.location,
          };
          // Recursively visit the expression
          session.info(
            `Resulting expression: ${JSON.stringify(node, null, 2)}`
          );
        }
      },
    });
    const replaceAnnotations = visitor.build({
      sequence(/** @type {PEG.ast.Sequence} */ node, env) {
        session.info(`Processing sequence: ${JSON.stringify(node, null, 2)}`);
        if (node.elements.length === 0) {
          this._sequence(node, env);
          return;
        }
        const first = node.elements[0];
        if (
          first.type === "labeled"
          && first.label
          && first.label.startsWith("argon$$")
        ) {
          if (first.expression.type !== "literal") {
            session.error(
              `Argon annotation must be a literal, got ${first.expression.type}`,
              first.location
            );
            return;
          }
          if (first.label === "argon$$type") {
            const name = first.expression.value;
            session.info(`Applying argon annotation: ${first.label}: ${name}`);
            // Remove the first element
            node.elements.splice(0, 1);
            // Convert the sequence to an action
            const expression = { ...node };
            delete node.elements;
            node.type = "action";
            node.expression = {
              type: "labeled",
              label: "value",
              labelLocation: expression.location,
              expression,
              location: expression.location,
            };
            node.code = 'return {value, type: "' + name + '"};';
            session.info(`Begining action: ${JSON.stringify(node, null, 2)}`);
            this._sequence(expression, env);
            session.info(`Resulting action: ${JSON.stringify(node, null, 2)}`);
          } else {
            session.error(
              `Unknown argon annotation: ${first.label}`,
              first.location
            );
          }
          return;
        }
        const last = node.elements[node.elements.length - 1];
        if (
          last.type === "labeled"
          && last.label
          && last.label === "argon$$action"
        ) {
          if (last.expression.type !== "semantic_and") {
            session.error(
              `Argon action must be a semantic_and, got ${last.expression.type}`,
              last.location
            );
            return;
          }
          session.info(`Applying argon action: ${last.expression.type}`);
          // Remove the last element
          node.elements.pop();
          // Convert the sequence to an action
          const expression = { ...node };
          delete node.elements;
          node.type = "action";
          node.expression = expression;
          node.code = last.expression.code;
          this._sequence(expression, env);
          return;
        }
        this._sequence(node, env);
      },
      action(/** @type {PEG.ast.Action} */ node) {
        if (node.code.startsWith("/* argon */")) {
          this._action(node);
        } else if (node.expression.type === "sequence") {
          const expression = node.expression;
          Object.keys(node).forEach(key => delete node[key]);
          Object.assign(node, expression);
          this.sequence(node);
        } else {
          const expression = node.expression;
          Object.keys(node).forEach(key => delete node[key]);
          Object.assign(node, {
            type: "sequence",
            elements: [expression],
            location: expression.location,
          });
          this.sequence(node);
        }
      },
    });
    replaceLabels(ast);
    replaceAnnotations(ast);
  } else {
    const replaceLabels = visitor.build({
      labeled(/** @type {PEG.ast.Labeled} */ node, env) {
        if (!node.label) {
          this._labeled(node, env);
          return;
        }
        if (
          node.label.startsWith("argon$")
          && !node.label.startsWith("argon$$")
        ) {
          session.info(
            `Removing argon label: ${node.label} -> ${node.label.slice(6)}`
          );
          node.label = node.label.slice(6);
        }
        this._labeled(node, env);
      },
    });
    const replaceAnnotations = visitor.build({
      sequence(/** @type {PEG.ast.Sequence} */ node, env) {
        if (
          node.elements.length > 0
          && node.elements[0].type === "labeled"
          && node.elements[0].label
          && node.elements[0].label.startsWith("argon$$")
        ) {
          session.info(`Removing argon annotation: ${node.elements[0].label}`);
          node.elements.splice(0, 1);
        }
        this._sequence(node, env);
      },
    });
    replaceLabels(ast);
    replaceAnnotations(ast);
  }
}

module.exports = handleArgon;

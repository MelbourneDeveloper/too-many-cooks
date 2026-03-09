/// Tests for tool input schema definitions.
/// Ensures maxLength and other constraints are present
/// so agents respect limits.

import { describe, it, expect } from "vitest";
import { MESSAGE_INPUT_SCHEMA } from "../lib/src/tools/message_tool.js";
import { PLAN_INPUT_SCHEMA } from "../lib/src/tools/plan_tool.js";
import {
  REGISTER_INPUT_SCHEMA,
  REGISTER_TOOL_CONFIG,
} from "../lib/src/tools/register_tool.js";

type SchemaObj = Record<string, unknown>;

const props = (schema: SchemaObj): Record<string, SchemaObj> => {
  const p = schema["properties"] as Record<string, SchemaObj> | undefined;
  if (p === undefined) throw new Error("No properties in schema");
  return p;
};

const field = (schema: SchemaObj, name: string): SchemaObj => {
  const f = props(schema)[name];
  if (f === undefined) throw new Error(`No field ${name} in schema`);
  return f;
};

const desc = (schema: SchemaObj, name: string): string => {
  const d = field(schema, name)["description"];
  if (typeof d !== "string") throw new Error(`No description for ${name}`);
  return d;
};

describe("message tool schema", () => {
  it("content has maxLength 200", () => {
    expect(
      field(MESSAGE_INPUT_SCHEMA as SchemaObj, "content")["maxLength"],
    ).toBe(200);
  });

  it("content description mentions 200 char limit", () => {
    expect(
      desc(MESSAGE_INPUT_SCHEMA as SchemaObj, "content"),
    ).toContain("200");
  });
});

describe("plan tool schema", () => {
  it("goal has maxLength 100", () => {
    expect(
      field(PLAN_INPUT_SCHEMA as SchemaObj, "goal")["maxLength"],
    ).toBe(100);
  });

  it("goal description mentions 100 char limit", () => {
    expect(
      desc(PLAN_INPUT_SCHEMA as SchemaObj, "goal"),
    ).toContain("100");
  });

  it("current_task has maxLength 100", () => {
    expect(
      field(PLAN_INPUT_SCHEMA as SchemaObj, "current_task")["maxLength"],
    ).toBe(100);
  });

  it("current_task description mentions char limit", () => {
    expect(
      desc(PLAN_INPUT_SCHEMA as SchemaObj, "current_task"),
    ).toContain("100");
  });
});

describe("register tool schema", () => {
  it("has name field for first registration", () => {
    expect(props(REGISTER_INPUT_SCHEMA as SchemaObj)).toHaveProperty("name");
  });

  it("has key field for reconnect", () => {
    expect(props(REGISTER_INPUT_SCHEMA as SchemaObj)).toHaveProperty("key");
  });

  it("name description says first registration only", () => {
    expect(
      desc(REGISTER_INPUT_SCHEMA as SchemaObj, "name"),
    ).toContain("FIRST");
  });

  it("key description says reconnect only", () => {
    expect(
      desc(REGISTER_INPUT_SCHEMA as SchemaObj, "key"),
    ).toContain("RECONNECT");
  });

  it("does not require both name and key", () => {
    // Schema should NOT have required: ['name', 'key']
    // Either name or key, not both — validated in handler
    expect(
      (REGISTER_INPUT_SCHEMA as SchemaObj)["required"],
    ).toBeUndefined();
  });

  it("description explains both modes", () => {
    const description = REGISTER_TOOL_CONFIG.description;
    expect(description).toContain("name");
    expect(description).toContain("key");
    expect(description).toContain("RECONNECT");
  });
});

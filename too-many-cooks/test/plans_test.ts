/// Tests for agent plan operations.

import { describe, it, beforeEach, afterEach, expect } from "vitest";
import fs from "node:fs";
import {
  type TooManyCooksDb,
  createDataConfig,
  createDb,
  ERR_UNAUTHORIZED,
  ERR_VALIDATION,
} from "../lib/src/data/data.js";

const TEST_DB_PATH = ".test_plans.db";

const deleteIfExists = (path: string): void => {
  try {
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
  } catch {
    // ignore
  }
};

describe("plans", () => {
  let db: TooManyCooksDb | undefined;
  let agentName = "";
  let agentKey = "";

  beforeEach(() => {
    deleteIfExists(TEST_DB_PATH);
    const config = createDataConfig({ dbPath: TEST_DB_PATH });
    const result = createDb(config);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    db = result.value;

    // Register test agent
    const regResult = db.register("plan-agent");
    if (!regResult.ok) throw new Error("expected ok");
    const reg = regResult.value;
    agentName = reg.agentName;
    agentKey = reg.agentKey;
  });

  afterEach(() => {
    db?.close();
    deleteIfExists(TEST_DB_PATH);
  });

  it("updatePlan creates new plan", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.updatePlan(
      agentName,
      agentKey,
      "Fix all bugs",
      "Reading codebase",
    );
    expect(result.ok).toBe(true);
  });

  it("updatePlan updates existing plan", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    db.updatePlan(agentName, agentKey, "Goal 1", "Task 1");

    const result = db.updatePlan(agentName, agentKey, "Goal 2", "Task 2");
    expect(result.ok).toBe(true);

    const getPlan = db.getPlan(agentName);
    if (!getPlan.ok) throw new Error("expected ok");
    const plan = getPlan.value!;
    expect(plan.goal).toBe("Goal 2");
    expect(plan.currentTask).toBe("Task 2");
  });

  it("updatePlan fails with invalid credentials", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.updatePlan(agentName, "wrong-key", "Goal", "Task");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe(ERR_UNAUTHORIZED);
  });

  it("updatePlan fails for goal exceeding max length", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const longGoal = "x".repeat(101); // Default max is 100
    const result = db.updatePlan(agentName, agentKey, longGoal, "Task");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe(ERR_VALIDATION);
    expect(result.error.message).toContain("100");
  });

  it("updatePlan fails for task exceeding max length", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const longTask = "x".repeat(101);
    const result = db.updatePlan(agentName, agentKey, "Goal", longTask);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe(ERR_VALIDATION);
  });

  it("getPlan returns plan for agent", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    db.updatePlan(agentName, agentKey, "My Goal", "Current Task");

    const result = db.getPlan(agentName);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const plan = result.value;
    expect(plan).toBeDefined();
    expect(plan!.agentName).toBe(agentName);
    expect(plan!.goal).toBe("My Goal");
    expect(plan!.currentTask).toBe("Current Task");
    expect(plan!.updatedAt).toBeGreaterThan(0);
  });

  it("getPlan returns null for agent without plan", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    // Register agent without setting plan
    const reg2 = db.register("no-plan-agent");
    if (!reg2.ok) throw new Error("expected ok");
    const agent2 = reg2.value;

    const result = db.getPlan(agent2.agentName);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const plan = result.value;
    expect(plan).toBeUndefined();
  });

  it("listPlans returns all plans", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    db.updatePlan(agentName, agentKey, "Goal 1", "Task 1");

    // Register second agent with plan
    const reg2 = db.register("plan-agent-2");
    if (!reg2.ok) throw new Error("expected ok");
    const agent2 = reg2.value;
    db.updatePlan(agent2.agentName, agent2.agentKey, "Goal 2", "Task 2");

    const result = db.listPlans();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const plans = result.value;
    expect(plans).toHaveLength(2);
    expect(new Set(plans.map((p) => p.goal))).toEqual(
      new Set(["Goal 1", "Goal 2"]),
    );
  });

  it("plan updatedAt changes on update", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    db.updatePlan(agentName, agentKey, "Goal", "Task 1");
    const getPlan1 = db.getPlan(agentName);
    if (!getPlan1.ok) throw new Error("expected ok");
    const plan1 = getPlan1.value;

    db.updatePlan(agentName, agentKey, "Goal", "Task 2");
    const getPlan2 = db.getPlan(agentName);
    if (!getPlan2.ok) throw new Error("expected ok");
    const plan2 = getPlan2.value;

    expect(plan2!.updatedAt).toBeGreaterThanOrEqual(plan1!.updatedAt);
  });
});

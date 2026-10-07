import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBlastRadius } from "./blastRadius.js";

test("(a) basit zincir: backbone-A-B-C, B düşerse C etkilenir, A etkilenmez", () => {
  const result = computeBlastRadius({
    switchIds: ["backbone", "A", "B", "C"],
    edges: [
      ["backbone", "A"],
      ["A", "B"],
      ["B", "C"]
    ],
    backboneIds: ["backbone"],
    targetId: "B"
  });

  assert.equal(result.hasBackbone, true);
  assert.equal(result.critical, true);
  assert.ok(result.affectedSwitchIds.includes("C"), "C etkilenmeli");
  assert.ok(result.affectedSwitchIds.includes("B"), "hedefin kendisi (B) her zaman listede olmalı");
  assert.ok(!result.affectedSwitchIds.includes("A"), "A etkilenmemeli (omurgaya hâlâ doğrudan bağlı)");
});

test("(b) yedekli yol: A omurgaya iki yoldan (M1, M2) bağlı, M1 düşse A etkilenmez", () => {
  const result = computeBlastRadius({
    switchIds: ["backbone", "M1", "M2", "A"],
    edges: [
      ["backbone", "M1"],
      ["M1", "A"],
      ["backbone", "M2"],
      ["M2", "A"]
    ],
    backboneIds: ["backbone"],
    targetId: "M1"
  });

  assert.equal(result.critical, false, "A hâlâ M2 üzerinden ulaşılabilir olduğu için kritik değil");
  assert.deepEqual(result.affectedSwitchIds, ["M1"], "sadece hedefin kendisi etkilenmeli");
});

test("(c) tek omurga düşerse herkes etkilenir", () => {
  const result = computeBlastRadius({
    switchIds: ["backbone", "A", "B"],
    edges: [
      ["backbone", "A"],
      ["A", "B"]
    ],
    backboneIds: ["backbone"],
    targetId: "backbone"
  });

  assert.equal(result.isBackboneTarget, true);
  assert.equal(result.remainingBackboneCount, 0);
  assert.equal(result.critical, true);
  assert.deepEqual(new Set(result.affectedSwitchIds), new Set(["backbone", "A", "B"]));
});

test("(d) çift omurga: biri düşerse diğerine bağlı olanlar etkilenmez", () => {
  const result = computeBlastRadius({
    switchIds: ["BB1", "BB2", "A", "B"],
    edges: [
      ["BB1", "A"],
      ["BB2", "B"]
    ],
    backboneIds: ["BB1", "BB2"],
    targetId: "BB1"
  });

  assert.equal(result.isBackboneTarget, true);
  assert.equal(result.remainingBackboneCount, 1, "BB2 hâlâ ayakta");
  assert.ok(result.affectedSwitchIds.includes("A"), "A sadece BB1'e bağlıydı, etkilenmeli");
  assert.ok(!result.affectedSwitchIds.includes("B"), "B, BB2'ye bağlı olduğu için etkilenmemeli");
});

test("(e) izole switch: omurgaya hiç bağlı değilse kendisi dışında kimseyi etkilemez, kritik değildir", () => {
  const result = computeBlastRadius({
    switchIds: ["backbone", "A", "ISO"],
    edges: [["backbone", "A"]],
    backboneIds: ["backbone"],
    targetId: "ISO"
  });

  assert.equal(result.targetWasReachable, false, "ISO zaten omurgaya bağlı değildi");
  assert.equal(result.critical, false);
  assert.deepEqual(result.affectedSwitchIds, ["ISO"], "sadece kendisi listelenir");
});

test("omurga hiç işaretlenmemişse hasBackbone false döner, hesap yapılmaz", () => {
  const result = computeBlastRadius({
    switchIds: ["A", "B"],
    edges: [["A", "B"]],
    backboneIds: [],
    targetId: "A"
  });

  assert.equal(result.hasBackbone, false);
  assert.deepEqual(result.affectedSwitchIds, []);
  assert.equal(result.critical, false);
});

test("normal durum: omurgaya bağlı ama gerçekten kritik olmayan bir yaprak switch", () => {
  const result = computeBlastRadius({
    switchIds: ["backbone", "leaf"],
    edges: [["backbone", "leaf"]],
    backboneIds: ["backbone"],
    targetId: "leaf"
  });

  assert.equal(result.targetWasReachable, true);
  assert.equal(result.critical, false, "leaf'in altında başka switch yok, kimseyi etkilemez");
  assert.deepEqual(result.affectedSwitchIds, ["leaf"]);
});

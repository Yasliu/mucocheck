import {
  AssessmentUnderstandingMap,
  MarkingCriterionItem,
  UnderstandingMapQuestionNode,
  UnderstandingMapStatus,
} from "./types";

/**
 * Computes a deterministic source document fingerprint.
 */
export function computeSourceFingerprint(
  path: string,
  name?: string,
  size?: number,
  mtime?: string
): string {
  const parts = [path.trim(), (name || "").trim(), size ? String(size) : "", mtime || ""].join("|");
  let hash = 0;
  for (let i = 0; i < parts.length; i++) {
    const char = parts.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `fp_${Math.abs(hash).toString(16)}`;
}

/**
 * Flattens hierarchical question nodes to retrieve all gradable leaf questions.
 * If a question has sub-questions, the sub-questions are the gradable leaves.
 * If a question has no sub-questions, it is itself a gradable leaf.
 */
export function flattenLeafQuestionNodes(
  nodes: UnderstandingMapQuestionNode[]
): UnderstandingMapQuestionNode[] {
  const leaves: UnderstandingMapQuestionNode[] = [];

  function traverse(node: UnderstandingMapQuestionNode) {
    if (node.sub_questions && node.sub_questions.length > 0) {
      for (const child of node.sub_questions) {
        traverse(child);
      }
    } else {
      leaves.push(node);
    }
  }

  for (const root of nodes) {
    traverse(root);
  }

  return leaves;
}

/**
 * Calculates the total maximum marks across all gradable leaf questions.
 */
export function calculateMapTotalMarks(nodes: UnderstandingMapQuestionNode[]): number {
  const leaves = flattenLeafQuestionNodes(nodes);
  const total = leaves.reduce((sum, leaf) => {
    // If teacher override exists, use adjusted marks
    const effectiveMarks = leaf.teacher_override?.adjusted_max_marks ?? leaf.max_marks;
    return sum + (Number(effectiveMarks) || 0);
  }, 0);
  return Math.round(total * 10) / 10;
}

/**
 * Verifies Cambridge IGCSE 0580 marking criteria integrity.
 * - M marks (Method): Independent valid method steps.
 * - A marks (Accuracy): Depend on previous correct M mark (cannot be awarded if M0).
 * - B marks: Independent marks for correct result/statement.
 * - FT: Follow-through marks correctly noted.
 */
export function checkCambridgeMarkRules(criteria: MarkingCriterionItem[]): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const criterionIds = new Set(criteria.map((c) => c.id));
  let hasMethodMark = false;

  for (const c of criteria) {
    if (c.mark_type === "M") {
      hasMethodMark = true;
    }

    if (c.mark_type === "A" && !hasMethodMark && !c.dependent_on) {
      warnings.push(
        `Accuracy mark (${c.id}) has no preceding Method (M) mark or explicit dependent_on criterion.`
      );
    }

    if (c.dependent_on && !criterionIds.has(c.dependent_on)) {
      warnings.push(
        `Criterion (${c.id}) depends on non-existent criterion ID "${c.dependent_on}".`
      );
    }

    if (c.marks <= 0) {
      warnings.push(`Criterion (${c.id}) must specify marks > 0.`);
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Evaluates whether an understanding map remains fresh or has become stale
 * due to changes in source Question Paper or Marking Scheme documents.
 */
export function evaluateMapFreshness(
  map: AssessmentUnderstandingMap | null | undefined,
  currentQuestionPaper?: { path?: string; name?: string; fingerprint?: string },
  currentMarkingScheme?: { path?: string; name?: string; fingerprint?: string }
): {
  status: UnderstandingMapStatus;
  isStale: boolean;
  staleReason?: string;
} {
  if (!map) {
    return {
      status: "not_generated",
      isStale: false,
    };
  }

  // Check Question Paper source integrity
  if (currentQuestionPaper?.path && map.source_question_paper.path !== currentQuestionPaper.path) {
    return {
      status: "stale",
      isStale: true,
      staleReason: `Question paper source path changed from "${map.source_question_paper.path}" to "${currentQuestionPaper.path}".`,
    };
  }

  if (
    currentQuestionPaper?.fingerprint &&
    map.source_question_paper.fingerprint !== currentQuestionPaper.fingerprint
  ) {
    return {
      status: "stale",
      isStale: true,
      staleReason: "Question paper source file content has changed (fingerprint mismatch).",
    };
  }

  // Check Marking Scheme source integrity
  if (currentMarkingScheme?.path && map.source_marking_scheme.path !== currentMarkingScheme.path) {
    return {
      status: "stale",
      isStale: true,
      staleReason: `Marking scheme source path changed from "${map.source_marking_scheme.path}" to "${currentMarkingScheme.path}".`,
    };
  }

  if (
    currentMarkingScheme?.fingerprint &&
    map.source_marking_scheme.fingerprint !== currentMarkingScheme.fingerprint
  ) {
    return {
      status: "stale",
      isStale: true,
      staleReason: "Marking scheme source file content has changed (fingerprint mismatch).",
    };
  }

  // If already flagged stale in database, preserve stale status
  if (map.status === "stale") {
    return {
      status: "stale",
      isStale: true,
      staleReason: "Map was marked stale.",
    };
  }

  return {
    status: map.status,
    isStale: false,
  };
}

/**
 * Validates structural integrity and correctness of an AssessmentUnderstandingMap.
 */
export function validateUnderstandingMap(data: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Understanding map must be an object."] };
  }

  const map = data as Partial<AssessmentUnderstandingMap>;

  if (!map.id || typeof map.id !== "string") {
    errors.push("Missing or invalid map ID.");
  }

  if (!map.assessment_id || typeof map.assessment_id !== "string") {
    errors.push("Missing or invalid assessment_id.");
  }

  if (typeof map.version !== "number" || map.version < 1) {
    errors.push("Map version must be an integer >= 1.");
  }

  const validStatuses: UnderstandingMapStatus[] = ["not_generated", "proposed", "verified", "stale"];
  if (!map.status || !validStatuses.includes(map.status)) {
    errors.push(`Invalid map status. Must be one of: ${validStatuses.join(", ")}`);
  }

  if (!map.source_question_paper || !map.source_question_paper.path) {
    errors.push("source_question_paper must include a valid document path.");
  }

  if (!map.source_marking_scheme || !map.source_marking_scheme.path) {
    errors.push("source_marking_scheme must include a valid document path.");
  }

  if (!Array.isArray(map.nodes)) {
    errors.push("nodes must be an array of question nodes.");
  } else {
    const seenNodeIds = new Set<string>();

    function validateNode(node: unknown, path: string) {
      if (!node || typeof node !== "object") {
        errors.push(`${path}: Node must be an object.`);
        return;
      }
      const n = node as Partial<UnderstandingMapQuestionNode>;
      if (!n.id || typeof n.id !== "string") {
        errors.push(`${path}: Node missing valid id.`);
      } else if (seenNodeIds.has(n.id)) {
        errors.push(`${path}: Duplicate node id "${n.id}".`);
      } else {
        seenNodeIds.add(n.id);
      }

      if (typeof n.question_number !== "number" || n.question_number < 1) {
        errors.push(`${path}: question_number must be >= 1.`);
      }

      if (!n.full_label || typeof n.full_label !== "string") {
        errors.push(`${path}: full_label is required.`);
      }

      if (typeof n.max_marks !== "number" || n.max_marks < 0) {
        errors.push(`${path}: max_marks must be >= 0.`);
      }

      // Validate bounding box coordinates if specified (normalized 0.0 to 1.0)
      if (n.question_paper_ref?.bbox) {
        const bbox = n.question_paper_ref.bbox;
        if (
          bbox.x < 0 || bbox.x > 1 ||
          bbox.y < 0 || bbox.y > 1 ||
          bbox.width < 0 || bbox.width > 1 ||
          bbox.height < 0 || bbox.height > 1
        ) {
          errors.push(`${path}: Question paper bounding box must use normalized coordinates (0.0 to 1.0).`);
        }
      }

      // Check sub-questions recursively
      if (n.sub_questions && Array.isArray(n.sub_questions)) {
        n.sub_questions.forEach((child, i) => validateNode(child, `${path}.sub_questions[${i}]`));
      }
    }

    map.nodes.forEach((root, i) => validateNode(root, `nodes[${i}]`));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

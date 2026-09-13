// GAT category constants — moved from the old src/data/schema.js verbatim.
// specificCategory (the Lesson name from the source Word docs) -> generalCategory.

export const GENERAL_CATEGORIES = {
  quantitative: [
    "Arithmetic",
    "Algebra",
    "Statistics & Data Analysis",
    "Geometry",
    "Miscellaneous Topics",
  ],
  // "The Odd One Out" was removed from the platform entirely (no longer a
  // supported category) — Verbal Test 1's source document still contained a
  // few Odd One Out questions, which were excluded during ingestion rather
  // than imported and hidden.
  verbal: [
    "Analogy",
    "Sentence Completion",
    "Contextual Error",
    "Reading Comprehension",
  ],
};

// Centralized so it can be inspected/changed in one place without touching
// individual questions. Populated from Quantitative Test 1's real lessons;
// extend as later tests introduce new lesson names.
//
// Entries below were not explicitly given in the original spec and are
// judgment calls, called out here rather than invented silently elsewhere:
//   - "Roots": paired with Exponents (its inverse operation) under Algebra,
//     consistent with how this document already treats Exponents.
//   - "Speed - Time - Distance": doesn't fit any of the four named categories
//     cleanly (it's a word-problem topic, not a math operation), so it's
//     placed in Miscellaneous Topics rather than forced into Algebra/Arithmetic.
//   - "Sequences & Patterns" (introduced in Test 2): finding a pattern/nth
//     term is algebraic reasoning, not a numeric operation or geometry topic,
//     so it's grouped under Algebra.
export const SPECIFIC_TO_GENERAL = {
  // Geometry
  "Shaded Areas": "Geometry",
  "Triangles": "Geometry",
  "Circles": "Geometry",
  "Angles": "Geometry",
  "Polygons & Quadrilaterals": "Geometry",
  "Areas, Perimeters & Volumes": "Geometry",

  // Algebra
  "Exponents": "Algebra",
  "Algebraic Expressions": "Algebra",
  "Equations & Inequalities": "Algebra",
  "Algebraic Expressions, Equations & Inequalities": "Algebra",
  "Roots": "Algebra", // judgment call — see comment above
  "Sequences & Patterns": "Algebra", // judgment call — see comment above

  // Statistics & Data Analysis
  "Statistics": "Statistics & Data Analysis",
  "Data Analysis": "Statistics & Data Analysis",

  // Arithmetic
  "Numbers & Order of Operations": "Arithmetic",
  "Decimals": "Arithmetic",
  "Fractions": "Arithmetic",
  "Division": "Arithmetic",
  "Ratios & Percentages": "Arithmetic",
  "Percentages & Ratios": "Arithmetic",
  "Proportions": "Arithmetic",

  // Miscellaneous Topics
  "Speed - Time - Distance": "Miscellaneous Topics", // judgment call — see comment above
};

// User acceptance criteria, 29.10.2026: OR within a facet, AND between facets,
// excluded equipment removes any matching lesson. Labels/tags are fixture data.
function filterLessons(lessons, selected = {}, excludedEquipment = []) {
  return lessons.filter(lesson =>
    !excludedEquipment.some(value => (lesson.facets.equipment || []).includes(value)) &&
    Object.entries(selected).every(([category, values]) =>
      !values.length || values.some(value => (lesson.facets[category] || []).includes(value))));
}
function groups(lessons) {
  const result = new Map();
  for (const lesson of lessons) {
    const group = result.get(lesson.section) || [];
    group.push(lesson); result.set(lesson.section, group);
  }
  return result;
}
module.exports = {filterLessons, groups};

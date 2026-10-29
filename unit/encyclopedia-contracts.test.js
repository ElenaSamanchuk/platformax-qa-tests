const {test} = require('node:test');
const assert = require('node:assert/strict');
const {filterLessons,groups} = require('../lib/encyclopedia-contracts');
const lessons = [
  {id:1,section:'a',facets:{body:['neck'],equipment:['barbell'],request:['strength']}},
  {id:2,section:'a',facets:{body:['shoulder'],equipment:['dumbbells'],request:['strength']}},
  {id:3,section:'b',facets:{body:['neck','shoulder'],equipment:[],request:['posture']}},
];
test('encyclopedia oracle: union, intersection and equipment subtraction are independent',()=>{
  assert.deepEqual(filterLessons(lessons,{body:['neck','shoulder']}).map(x=>x.id),[1,2,3]);
  assert.deepEqual(filterLessons(lessons,{body:['neck','shoulder'],request:['strength']}).map(x=>x.id),[1,2]);
  assert.deepEqual(filterLessons(lessons,{body:['neck','shoulder']},['barbell']).map(x=>x.id),[2,3]);
  assert.deepEqual(filterLessons(lessons,{body:['neck'],equipment:['dumbbells']}).map(x=>x.id),[]);
  assert.deepEqual([...groups(lessons)].map(([k,v])=>[k,v.length]),[['a',2],['b',1]]);
});

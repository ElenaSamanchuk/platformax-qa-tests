const test=require('node:test');const assert=require('node:assert/strict');
const {fixture,attemptState,historical,localPath}=require('../lib/homework-contracts');
const base='https://qa.test.nn99.ru';
const f={studentId:1,homeworkId:2,chapterHomeworkId:3,title:'QA-AT fixture',source:'approved task/date',exclusive:true,chapterLinked:true,lessonPath:'/lesson/4',blockSelector:'[data-block-id="5"]',durationType:'estimated',openLabel:'Открыть задание'};
test('HW boundaries: refuse production, cross-origin, shared IDs, timed and unlinked-only fixtures',()=> {
 assert.equal(fixture(f,base),f);
 for(const patch of [{studentId:0},{title:'Luna'},{chapterLinked:false},{exclusive:false},{durationType:'timer'},{source:''},{lessonPath:'//example.com/lesson'}]) assert.throws(()=>fixture({...f,...patch},base),/BLOCKED/);
 assert.throws(()=>fixture(f,'https://qa.nn99.ru'));
 assert.throws(()=>localPath('/\\example.com',base),/BLOCKED/);
});
test('HW no-start comparison detects consumed/current/new attempts independent of history order',()=> {
 const p={attemptsLeft:4,currentAttempt:null,attemptsHistory:[{id:4,status:'reviewed'},{id:2,status:'reviewed'}]};
 assert.deepEqual(attemptState(p),attemptState({...p,attemptsHistory:[...p.attemptsHistory].reverse()}));
 assert.notDeepEqual(attemptState(p),attemptState({...p,attemptsLeft:3,currentAttempt:{id:5,status:'in_progress',started_at:'now'}}));
 assert.throws(()=>attemptState({}),/schema/);
});
test('H17 refuses latest/unreviewed/missing attempt instead of approving wrong result',()=> {
 const p={attemptsHistory:[{id:4,status:'on_review'},{id:2,status:'reviewed'},{id:1,status:'on_review'}]};
 assert.equal(historical(p,2).id,2);
 for(const id of [4,1,9,0]) assert.throws(()=>historical(p,id),/BLOCKED/);
});

import { testResumeCrud } from './src/tools/test_resume_crud.js';

async function runTest() {
  try {
    console.log('Starting resume CRUD test...');
    
    const result = await testResumeCrud({
      save_schema: true,
      create_resume: true,
      update_resume: true,
      delete_resume: true
    });
    
    console.log('Test completed with result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

runTest();

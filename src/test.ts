import request = require('supertest');
import express = require('express');
import { driveRoutes } from './api/drive';

describe('Drive permissions endpoints', () => {
  let app: express.Express;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    driveRoutes(app);
  });

  it('should fail if missing params (add)', async () => {
    const res = await request(app).post('/actions/drive/permissions/add').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fileId/);
  });

  it('should fail if missing params (remove)', async () => {
    const res = await request(app).post('/actions/drive/permissions/remove').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fileId/);
  });

  // NOTE: The following tests require valid Google Drive setup and will fail without proper mocks or env
  // it('should add and remove permission (integration)', async () => {
  //   const fileId = 'test-file-id';
  //   const email = 'test@example.com';
  //   const role = 'reader';
  //   const addRes = await request(app).post('/actions/drive/permissions/add').send({ fileId, email, role });
  //   expect(addRes.status).toBe(200);
  //   expect(addRes.body.permissionId).toBeDefined();
  //   const removeRes = await request(app).post('/actions/drive/permissions/remove').send({ fileId, permissionId: addRes.body.permissionId });
  //   expect(removeRes.status).toBe(200);
  // });
});

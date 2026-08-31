import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// Configure axios defaults
axios.defaults.baseURL = API_BASE;

// Request interceptor — attach JWT token
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle token expiry
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/auth/refresh', { refreshToken });
          localStorage.setItem('token', data.token);
          original.headers['Authorization'] = `Bearer ${data.token}`;
          return axios(original);
        } catch {
          localStorage.clear();
          window.location.href = '/';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── API client functions ───────────────────────────────────────────────────────
export const api = {
  // Auth
  adminLogin: (data) => axios.post('/auth/admin/login', data),
  adminCreate: (data) => axios.post('/auth/admin/create', data),
  candidateRegister: (data) => axios.post('/auth/candidate/register', data),
  candidateLogin: (data) => axios.post('/auth/candidate/login', data),
  logout: () => axios.post('/auth/logout'),

  // Tests
  createTest: (data) => axios.post('/tests', data),
  getTests: () => axios.get('/tests'),
  getTest: (id) => axios.get(`/tests/${id}`),
  updateTest: (id, data) => axios.patch(`/tests/${id}`, data),
  updatePassingCriteria: (id, data) => axios.patch(`/tests/${id}/passing-criteria`, data),
  updateMalpracticeThreshold: (id, data) => axios.patch(`/tests/${id}/malpractice-threshold`, data),
  deleteTest: (id) => axios.delete(`/tests/${id}`),
  startTest: (id) => axios.post(`/tests/${id}/start`),
  endTest: (id) => axios.post(`/tests/${id}/end`),

  // Rooms
  createRoom: (testId, data) => axios.post(`/tests/${testId}/rooms`, data),
  getRooms: (testId) => axios.get(`/tests/${testId}/rooms`),
  getLiveCandidates: (testId) => axios.get(`/tests/${testId}/live-candidates`),
  deleteRoom: (roomId) => axios.delete(`/rooms/${roomId}`),
  getRoomCandidates: (roomId) => axios.get(`/rooms/${roomId}/candidates`),

  // Question Sets
  createQuestionSet: (data) => axios.post('/question-sets', data),
  getQuestionSets: () => axios.get('/question-sets'),
  createQuestion: (setId, data) => axios.post(`/question-sets/${setId}/questions`, data),
  getQuestions: (setId) => axios.get(`/question-sets/${setId}/questions`),
  updateQuestion: (qId, data) => axios.patch(`/questions/${qId}`, data),
  deleteQuestion: (qId) => axios.delete(`/questions/${qId}`),

  // Candidate Test-Taking
  joinRoom: (data) => axios.post('/rooms/join', data),
  startAttempt: (testId, data) => axios.post(`/tests/${testId}/start-attempt`, data),
  getQuestion: (testId, qId) => axios.get(`/tests/${testId}/questions/${qId}`),
  runCode: (qId, data) => axios.post(`/submissions/${qId}/run`, data),
  saveCode: (qId, data) => axios.post(`/submissions/${qId}/save`, data),
  submitCode: (qId, data) => axios.post(`/submissions/${qId}/submit`, data),
  submitAll: (testId) => axios.post(`/tests/${testId}/submit-all`),

  // AI Test
  aiChat: (qId, data) => axios.post(`/ai-test/${qId}/chat`, data),
  saveFiles: (qId, data) => axios.post(`/ai-test/${qId}/save-files`, data),
  submitAiTest: (qId, data) => axios.post(`/ai-test/${qId}/submit`, data),
  getPreview: (qId) => axios.get(`/ai-test/${qId}/preview`),

  // Proctoring
  submitFrame: (testId, formData) =>
    axios.post(`/proctoring/${testId}/frame`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  reportViolation: (data) => axios.post('/proctoring/violation', data),
  reviewMalpractice: (logId, data) => axios.patch(`/malpractice-logs/${logId}/review`, data),
  getCandidateMalpracticeLogs: (testId, candidateId) =>
    axios.get(`/tests/${testId}/candidates/${candidateId}/malpractice-logs`),
  getTestMalpracticeLogs: (testId, params) =>
    axios.get(`/tests/${testId}/malpractice-logs`, { params }),

  // Evaluation / Reports
  getResults: (testId) => axios.get(`/tests/${testId}/results`),
  getShortlist: (testId) => axios.get(`/tests/${testId}/shortlist`),
  regenerateShortlist: (testId) => axios.post(`/tests/${testId}/shortlist/regenerate`),
  exportShortlistPdf: (testId) =>
    axios.get(`/tests/${testId}/shortlist/export-pdf`, { responseType: 'blob' }),
  getCopyPasteLog: (submissionId) =>
    axios.get(`/submissions/${submissionId}/copy-paste-log`),
};

export default api;

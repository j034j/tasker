
import axios from 'axios';

export const api = axios.create({
    baseURL: '/api',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('tasker_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        if (status === 401) {
            // Stale/invalid JWT after server secret rotation or DB reset.
            localStorage.removeItem('tasker_token');
            localStorage.removeItem('tasker_user');
            localStorage.removeItem('tasker_org_id');
            localStorage.removeItem('tasker_org_name');
            localStorage.removeItem('tasker_last_board_id');
            if (window.location.pathname !== '/') {
                window.location.href = '/';
            }
        }
        return Promise.reject(error);
    }
);

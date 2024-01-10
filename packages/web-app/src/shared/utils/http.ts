import axios from 'axios';

const httpClient = axios.create({ baseURL: '/api' });

export default httpClient;

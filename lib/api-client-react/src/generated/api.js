import {
  useMutation,
  useQuery
} from "@tanstack/react-query";
import { customFetch } from "../custom-fetch";
const withQueryKey = (query, queryKey) => {
  const result = { queryKey };
  for (const key of Object.keys(query)) {
    if (key === "queryKey") continue;
    Object.defineProperty(result, key, {
      enumerable: true,
      configurable: true,
      get: () => query[key]
    });
  }
  return result;
};
const getHealthCheckUrl = () => {
  return `/api/healthz`;
};
const healthCheck = async (options) => {
  return customFetch(
    getHealthCheckUrl(),
    {
      ...options,
      method: "GET"
    }
  );
};
const getHealthCheckQueryKey = () => {
  return [
    `/api/healthz`
  ];
};
const getHealthCheckQueryOptions = (options) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getHealthCheckQueryKey();
  const queryFn = ({ signal }) => healthCheck({ signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions };
};
function useHealthCheck(options) {
  const queryOptions = getHealthCheckQueryOptions(options);
  const query = useQuery(queryOptions);
  return withQueryKey(query, queryOptions.queryKey);
}
const getGetSensorLatestUrl = () => {
  return `/api/sensor/latest`;
};
const getSensorLatest = async (options) => {
  return customFetch(
    getGetSensorLatestUrl(),
    {
      ...options,
      method: "GET"
    }
  );
};
const getGetSensorLatestQueryKey = () => {
  return [
    `/api/sensor/latest`
  ];
};
const getGetSensorLatestQueryOptions = (options) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetSensorLatestQueryKey();
  const queryFn = ({ signal }) => getSensorLatest({ signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions };
};
function useGetSensorLatest(options) {
  const queryOptions = getGetSensorLatestQueryOptions(options);
  const query = useQuery(queryOptions);
  return withQueryKey(query, queryOptions.queryKey);
}
const getGetSensorHistoryUrl = (params) => {
  const normalizedParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== void 0) {
      normalizedParams.append(key, value === null ? "null" : String(value));
    }
  });
  const stringifiedParams = normalizedParams.toString();
  return stringifiedParams.length > 0 ? `/api/sensor/history?${stringifiedParams}` : `/api/sensor/history`;
};
const getSensorHistory = async (params, options) => {
  return customFetch(
    getGetSensorHistoryUrl(params),
    {
      ...options,
      method: "GET"
    }
  );
};
const getGetSensorHistoryQueryKey = (params) => {
  return [
    `/api/sensor/history`,
    ...params ? [params] : []
  ];
};
const getGetSensorHistoryQueryOptions = (params, options) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetSensorHistoryQueryKey(params);
  const queryFn = ({ signal }) => getSensorHistory(params, { signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions };
};
function useGetSensorHistory(params, options) {
  const queryOptions = getGetSensorHistoryQueryOptions(params, options);
  const query = useQuery(queryOptions);
  return withQueryKey(query, queryOptions.queryKey);
}
const getPostSensorDataUrl = () => {
  return `/api/sensor/data`;
};
const postSensorData = async (sensorDataInput, options) => {
  const getHeaders = (h) => {
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(h.entries());
    if (Symbol.iterator in h) {
      return Object.fromEntries(
        Array.from(h, (entry) => Array.from(entry))
      );
    }
    const headers = {};
    for (const [name, value] of Object.entries(h)) {
      if (value !== void 0) headers[name] = value;
    }
    return headers;
  };
  return customFetch(
    getPostSensorDataUrl(),
    {
      ...options,
      method: "POST",
      headers: { "Content-Type": "application/json", ...getHeaders(options?.headers) },
      body: JSON.stringify(sensorDataInput)
    }
  );
};
const getPostSensorDataMutationKey = () => ["postSensorData"];
const getPostSensorDataMutationOptions = (options) => {
  const mutationKey = getPostSensorDataMutationKey();
  const { mutation: mutationOptions, request: requestOptions } = options ? options.mutation && "mutationKey" in options.mutation && options.mutation.mutationKey ? options : { ...options, mutation: { ...options.mutation, mutationKey } } : { mutation: { mutationKey }, request: void 0 };
  const mutationFn = (props) => {
    const { data } = props ?? {};
    return postSensorData(data, requestOptions);
  };
  return { mutationFn, ...mutationOptions };
};
const usePostSensorData = (options) => {
  return useMutation(getPostSensorDataMutationOptions(options));
};
export {
  getGetSensorHistoryQueryKey,
  getGetSensorHistoryQueryOptions,
  getGetSensorHistoryUrl,
  getGetSensorLatestQueryKey,
  getGetSensorLatestQueryOptions,
  getGetSensorLatestUrl,
  getHealthCheckQueryKey,
  getHealthCheckQueryOptions,
  getHealthCheckUrl,
  getPostSensorDataMutationKey,
  getPostSensorDataMutationOptions,
  getPostSensorDataUrl,
  getSensorHistory,
  getSensorLatest,
  healthCheck,
  postSensorData,
  useGetSensorHistory,
  useGetSensorLatest,
  useHealthCheck,
  usePostSensorData
};

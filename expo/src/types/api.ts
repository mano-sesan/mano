import type { UserResponseData } from "@/types/user";

export type RequestInit = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers: Record<string, string>;
  body?: string;
};

export type MutateMethod = "POST" | "PUT" | "DELETE";

export type ApiArgs = {
  method: RequestInit["method"];
  path: string;
  body?: Record<string, any>;
  query?: Query;
  headers?: RequestInit["headers"];
  debug?: boolean;
  entityType?: string;
  entityId?: string;
  offlineEnabled?: boolean;
};

export interface PostApiArgs extends Omit<ApiArgs, "method"> {
  body?: Record<string, any>;
}

export interface GetApiArgs extends Omit<ApiArgs, "method"> {
  query?: Query;
}

export interface PutApiArgs extends Omit<ApiArgs, "method"> {
  body: Record<string, any>;
}

export type DeleteApiArgs = Omit<ApiArgs, "method"> & {
  body?: Record<string, any>;
};

export type Query = Record<string, string | Date | boolean | undefined | number>;

export type ApiResponse = {
  ok: boolean;
  user?: UserResponseData;
  token?: string;
  data?: any;
  decryptedData?: any;
  error?: string;
  code?: string;
  hasMore?: boolean;
  message?: string;
  inAppMessage?: [
    string,
    string,
    {
      text: string;
      link: string;
      onPress: () => void;
    }[],
    {
      [key: string]: any;
    },
  ];
};

export type OfflineApiResponse = ApiResponse & {
  _offlineQueued: boolean;
  _queueItemId: string;
};

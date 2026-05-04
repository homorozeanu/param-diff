export type Param = {
  id: string;
  key: string;
  // The current displayed value, peeled by Decode clicks.
  value: string;
  // The original raw value, used by Reset.
  rawValue: string;
  // How many times Decode has been applied to rawValue.
  decodeCount: number;
  // When expanded, value is treated as a URL/query-string and split into nestedParams.
  expanded: boolean;
  // The portion of the value before '?' when expanded (e.g. "/connect/authorize/callback").
  nestedBase?: string;
  nestedParams?: Param[];
};

export type ParsedUrl = {
  // The portion before '?', e.g. "http://localhost:33020/app/en-GB/login/".
  base: string;
  params: Param[];
};

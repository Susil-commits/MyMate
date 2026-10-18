declare module "qrcode" {
  const qrcode: any;
  export default qrcode;
  export function toDataURL(text: string, options?: any): Promise<string>;
  export function toString(text: string, options?: any): Promise<string>;
}

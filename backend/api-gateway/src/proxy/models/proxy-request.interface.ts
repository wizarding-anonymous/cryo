import { HttpMethod } from '../../common/enums/http-method.enum';
import { User } from '../../common/models/user.interface';

export interface ProxyRequest {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
  user?: User;
}

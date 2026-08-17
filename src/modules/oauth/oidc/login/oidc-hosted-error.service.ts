import { Injectable } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';

type OidcHostedErrorPayload = {
  error?: string;
  error_description?: string;
  state?: string;
};

type OidcErrorRenderContext = {
  status: number;
  redirect: (url: string) => void;
};

@Injectable()
export class OidcHostedErrorService {
  constructor(private readonly appEnv: AppEnvService) {}

  buildHostedErrorUrl(out: OidcHostedErrorPayload): string {
    const url = new URL('/oauth/error', this.appEnv.AUTH_FRONTEND_URL);

    if (out.error) {
      url.searchParams.set('error', out.error);
    }

    if (out.error_description) {
      url.searchParams.set('error_description', out.error_description);
    }

    if (out.state) {
      url.searchParams.set('state', out.state);
    }

    return url.toString();
  }

  renderError = async (
    ctx: OidcErrorRenderContext,
    out: OidcHostedErrorPayload,
  ): Promise<void> => {
    ctx.status = 303;
    ctx.redirect(this.buildHostedErrorUrl(out));
  };
}

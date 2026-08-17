import { Injectable } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';

type OidcLogoutHtmlContext = {
  type?: string;
  status?: number;
  body?: string;
};

@Injectable()
export class OidcLogoutUiService {
  constructor(private readonly appEnv: AppEnvService) {}

  /** Auto-submit RP-initiated logout confirmation (browser flow). */
  logoutSource = async (
    ctx: OidcLogoutHtmlContext,
    form: string,
  ): Promise<void> => {
    ctx.type = 'html';
    ctx.status = 200;
    ctx.body = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Signing out</title>
</head>
<body>
  ${form}
  <script>document.getElementById('op.logoutForm').submit()</script>
</body>
</html>`;
  };

  /** Shown when no post_logout_redirect_uri is registered. */
  postLogoutSuccessSource = async (ctx: OidcLogoutHtmlContext): Promise<void> => {
    const loginUrl = new URL('/login', this.appEnv.AUTH_FRONTEND_URL).toString();

    ctx.type = 'html';
    ctx.status = 200;
    ctx.body = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Signed out</title>
</head>
<body>
  <p>You have been signed out.</p>
  <p><a href="${loginUrl}">Return to sign in</a></p>
</body>
</html>`;
  };
}

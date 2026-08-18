import { Injectable, Logger } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';

type OidcLogoutHtmlContext = {
  type?: string;
  status?: number;
  body?: string;
};

const LOGOUT_CONFIRM_FIELD =
  '<input type="hidden" name="logout" value="yes" />';

@Injectable()
export class OidcLogoutUiService {
  private readonly logger = new Logger(OidcLogoutUiService.name);

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
  ${this.withLogoutConfirmation(form)}
  <noscript>
    <button type="submit" form="op.logoutForm" name="logout" value="yes">Sign out</button>
  </noscript>
  <script>document.getElementById('op.logoutForm').submit()</script>
</body>
</html>`;
  };

  /**
   * oidc-provider renders only the xsrf field; `logout=yes` normally comes from the
   * confirmation button. A scripted `form.submit()` drops button values, and without
   * `logout` the provider keeps the SSO session alive and only drops the calling
   * client's grant — so the next authorize would silently re-authenticate.
   */
  private withLogoutConfirmation(form: string): string {
    if (/name="logout"/.test(form)) {
      return form;
    }

    if (!form.includes('</form>')) {
      this.logger.error(
        'Unexpected end_session form markup: cannot inject logout confirmation, SSO session will survive logout',
      );
      return form;
    }

    return form.replace('</form>', `${LOGOUT_CONFIRM_FIELD}</form>`);
  }

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

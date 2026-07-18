import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Zachytávač chýb — namiesto bielej obrazovky zobrazí zrozumiteľnú hlášku.
 *  Bez neho jediná chyba kdekoľvek v aplikácii zhodí celú stránku. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // ponecháme v konzole kvôli dohľadaniu príčiny
    console.error('TOPSPIN – neočakávaná chyba:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return <div className="login-shell"><div className="login-box">
      <img src="/topspin.png" alt="TOPSPIN" />
      <h1>Niečo sa pokazilo</h1>
      <p>Stránku sa nepodarilo zobraziť. Tvoje uložené dáta sú v poriadku — chyba je len v zobrazení.</p>
      <div className="row-actions">
        <button className="button primary" onClick={() => { this.setState({ error: null }); location.reload(); }}>Skúsiť znova</button>
        <a className="button" href="/">Späť na turnaje</a>
      </div>
      <details className="err-detail"><summary>Technické podrobnosti</summary>
        <code>{error.message}</code></details>
    </div></div>;
  }
}

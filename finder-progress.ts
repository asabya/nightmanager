import { Loader, type TUI } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";

/**
 * Progress indicator for finder subagent searches.
 * Wraps Loader component for use as a TUI widget.
 */
export class FinderProgress implements Component {
	private loader: Loader;

	constructor(
		tui: TUI,
		theme: { fg: (color: string, text: string) => string },
		message: string = "Searching...",
	) {
		this.loader = new Loader(
			tui,
			theme.fg.bind(theme, "accent"),
			theme.fg.bind(theme, "muted"),
			message,
		);
	}

	setMessage(message: string): void {
		this.loader.setMessage(message);
	}

	dispose(): void {
		this.loader.stop();
	}

	render(width: number): string[] {
		return this.loader.render(width);
	}

	invalidate(): void {
		this.loader.invalidate();
	}
}
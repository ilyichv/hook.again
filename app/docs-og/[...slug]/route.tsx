import { generateOGImage } from "fumadocs-ui/og";
import { metadataImage } from "../../../lib/metadata";

export const GET = metadataImage.createAPI((page) => {
	return generateOGImage({
		title: page.data.title,
		description: page.data.description,
		site: "hookagain",
		primaryTextColor: "rgb(240,240,240)",
		primaryColor: "rgba(65,65,84,0.9)",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				width={48}
				height={48}
			>
				<path stroke="none" d="M0 0h24v24H0z" fill="none" />
				<path d="M16 9v6a5 5 0 0 1 -10 0v-4l3 3" />
				<path d="M16 7m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
				<path d="M16 5v-2" />
			</svg>
		),
	});
});

export function generateStaticParams() {
	return metadataImage.generateParams();
}

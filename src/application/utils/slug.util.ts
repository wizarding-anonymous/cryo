/**
 * Generates a URL-friendly slug from a title string.
 * @param title The string to convert into a slug.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // remove special characters
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/-+/g, '-'); // remove consecutive hyphens
}

/**
 * Generates a unique slug by checking for its existence and appending a counter if necessary.
 * @param title The title to generate a slug from.
 * @param checker A function that takes a slug and returns a promise resolving to a truthy value if the slug exists, or a falsy value otherwise.
 * @returns A promise that resolves to a unique slug.
 */
export async function generateUniqueSlug(
  title: string,
  checker: (slug: string) => Promise<unknown>,
): Promise<string> {
  let slug = slugify(title);
  let isTaken = await checker(slug);
  let counter = 1;

  while (isTaken) {
    const newSlug = `${slug}-${counter}`;
    isTaken = await checker(newSlug);
    if (!isTaken) {
      slug = newSlug;
    }
    counter++;
  }

  return slug;
}

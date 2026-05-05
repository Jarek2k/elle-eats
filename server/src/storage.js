export function slugify(title) {
  return (title || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function createStorage(db) {
  const imagesFor = (slug) =>
    db.prepare(
      'SELECT filename FROM recipe_images WHERE recipe_slug = ? ORDER BY position'
    ).all(slug).map(r => r.filename);

  return {
    loadWeek(weekKey) {
      const rows = db.prepare(
        'SELECT iso_date, dish FROM weeks WHERE week_key = ?'
      ).all(weekKey);
      const out = {};
      for (const { iso_date, dish } of rows) out[iso_date] = dish;
      return out;
    },

    setDish(weekKey, isoDate, name) {
      const trimmed = (name || '').trim();
      if (trimmed) {
        db.prepare(`
          INSERT INTO weeks (week_key, iso_date, dish) VALUES (?, ?, ?)
          ON CONFLICT(week_key, iso_date) DO UPDATE SET dish = excluded.dish
        `).run(weekKey, isoDate, trimmed);
      } else {
        db.prepare(
          'DELETE FROM weeks WHERE week_key = ? AND iso_date = ?'
        ).run(weekKey, isoDate);
      }
    },

    listWeeks() {
      return db.prepare(
        'SELECT DISTINCT week_key FROM weeks ORDER BY week_key'
      ).all().map(r => r.week_key);
    },

    loadRecipes() {
      const rows = db.prepare('SELECT * FROM recipes ORDER BY title').all();
      const out = {};
      for (const r of rows) {
        out[r.slug] = {
          title: r.title,
          ingredients: r.ingredients,
          steps: r.steps,
          notes: r.notes,
          images: imagesFor(r.slug),
          updatedAt: r.updated_at,
        };
      }
      return out;
    },

    getRecipe(slug) {
      if (!slug) return null;
      const r = db.prepare('SELECT * FROM recipes WHERE slug = ?').get(slug);
      if (!r) return null;
      return {
        slug: r.slug,
        title: r.title,
        ingredients: r.ingredients,
        steps: r.steps,
        notes: r.notes,
        images: imagesFor(slug),
        updatedAt: r.updated_at,
      };
    },

    findRecipeByTitle(title) {
      return this.getRecipe(slugify(title));
    },

    saveRecipe(prevSlug, recipe) {
      const newTitle = (recipe.title || '').trim();
      if (!newTitle) return { error: 'empty-title' };
      const newSlug = slugify(newTitle);
      const updatedAt = new Date().toISOString();

      const tx = db.transaction(() => {
        if (newSlug !== prevSlug) {
          const existing = db.prepare('SELECT 1 FROM recipes WHERE slug = ?').get(newSlug);
          if (existing) return { error: 'collision' };
        }

        if (prevSlug && prevSlug !== newSlug) {
          db.prepare(`
            UPDATE recipes
            SET slug = ?, title = ?, ingredients = ?, steps = ?, notes = ?, updated_at = ?
            WHERE slug = ?
          `).run(newSlug, newTitle, recipe.ingredients || '', recipe.steps || '', recipe.notes || '', updatedAt, prevSlug);

          db.prepare(
            'UPDATE recipe_images SET recipe_slug = ? WHERE recipe_slug = ?'
          ).run(newSlug, prevSlug);

          const updateWeek = db.prepare(
            'UPDATE weeks SET dish = ? WHERE week_key = ? AND iso_date = ?'
          );
          for (const w of db.prepare('SELECT week_key, iso_date, dish FROM weeks').all()) {
            if (slugify(w.dish) === prevSlug) {
              updateWeek.run(newTitle, w.week_key, w.iso_date);
            }
          }
        } else {
          db.prepare(`
            INSERT INTO recipes (slug, title, ingredients, steps, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
              title       = excluded.title,
              ingredients = excluded.ingredients,
              steps       = excluded.steps,
              notes       = excluded.notes,
              updated_at  = excluded.updated_at
          `).run(newSlug, newTitle, recipe.ingredients || '', recipe.steps || '', recipe.notes || '', updatedAt);
        }

        return { slug: newSlug };
      });

      return tx.immediate();
    },

    deleteRecipe(slug) {
      db.prepare('DELETE FROM recipes WHERE slug = ?').run(slug);
    },

    recipeUsageCount(slug) {
      let n = 0;
      for (const { dish } of db.prepare('SELECT dish FROM weeks').all()) {
        if (slugify(dish) === slug) n++;
      }
      return n;
    },

    listSuggestions() {
      const lastUse = new Map();
      for (const { iso_date, dish } of db.prepare('SELECT iso_date, dish FROM weeks').all()) {
        if (!dish) continue;
        const s = slugify(dish);
        const prev = lastUse.get(s);
        if (!prev || iso_date > prev.iso) lastUse.set(s, { iso: iso_date, name: dish });
      }

      const recipeRows = db.prepare('SELECT slug, title FROM recipes').all();
      const recipeSlugs = new Set(recipeRows.map(r => r.slug));
      const entries = [];
      for (const r of recipeRows) {
        const use = lastUse.get(r.slug);
        entries.push({ slug: r.slug, title: r.title, isRecipe: true, lastIso: use ? use.iso : '' });
      }
      for (const [slug, use] of lastUse.entries()) {
        if (recipeSlugs.has(slug)) continue;
        entries.push({ slug, title: use.name, isRecipe: false, lastIso: use.iso });
      }

      entries.sort((a, b) => {
        if (a.lastIso && b.lastIso) return b.lastIso.localeCompare(a.lastIso);
        if (a.lastIso) return -1;
        if (b.lastIso) return 1;
        return a.title.localeCompare(b.title, 'de');
      });
      return entries;
    },

    listImages(slug) {
      return imagesFor(slug);
    },

    addImage(slug, filename) {
      const recipe = db.prepare('SELECT 1 FROM recipes WHERE slug = ?').get(slug);
      if (!recipe) return { error: 'not-found' };

      const tx = db.transaction(() => {
        const max = db.prepare(
          'SELECT MAX(position) AS m FROM recipe_images WHERE recipe_slug = ?'
        ).get(slug);
        const position = (max?.m ?? -1) + 1;
        db.prepare(
          'INSERT INTO recipe_images (recipe_slug, position, filename) VALUES (?, ?, ?)'
        ).run(slug, position, filename);
        db.prepare(
          'UPDATE recipes SET updated_at = ? WHERE slug = ?'
        ).run(new Date().toISOString(), slug);
        return { ok: true, position };
      });
      return tx.immediate();
    },

    removeImage(slug, index) {
      const tx = db.transaction(() => {
        const row = db.prepare(
          'SELECT filename FROM recipe_images WHERE recipe_slug = ? AND position = ?'
        ).get(slug, index);
        if (!row) return { error: 'not-found' };

        db.prepare(
          'DELETE FROM recipe_images WHERE recipe_slug = ? AND position = ?'
        ).run(slug, index);

        const remaining = db.prepare(
          'SELECT position FROM recipe_images WHERE recipe_slug = ? ORDER BY position'
        ).all(slug);
        const renumber = db.prepare(
          'UPDATE recipe_images SET position = ? WHERE recipe_slug = ? AND position = ?'
        );
        remaining.forEach((r, i) => {
          if (r.position !== i) renumber.run(i, slug, r.position);
        });

        db.prepare(
          'UPDATE recipes SET updated_at = ? WHERE slug = ?'
        ).run(new Date().toISOString(), slug);
        return { ok: true, filename: row.filename };
      });
      return tx.immediate();
    },
  };
}

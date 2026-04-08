# Theme Configuration

## CSS Variables (`globals.css`)
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');

@import "tailwindcss";

:root {
  /* Soft Botanical Palette */
  --sage-light: #F8FAF9;
  --sage-medium: #E1E8E4;
  --forest-soft: #2D4A3E;
  --leaf-green: #86A397;
  --blossom-pink: #F2D5D5;
  --earth-tan: #D9CFC1;
  
  --magenta: #D47A9A; /* Softened magenta */
  --teal: #5FB4A2;    /* Softened teal */
  --gold: #D4AF37;    /* Earthy gold */
  --coral: #E68A8A;   /* Softened coral */
  
  --text-primary: #2D4A3E;
  --text-muted: rgba(45, 74, 62, 0.6);
  --glass: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(255, 255, 255, 0.8);

  --font-serif: 'Playfair Display', serif;
  --font-sans: 'DM Sans', sans-serif;
}

@theme inline {
  --color-sage-light: var(--sage-light);
  --color-sage-medium: var(--sage-medium);
  --color-forest: var(--forest-soft);
  --color-leaf: var(--leaf-green);
  --color-blossom: var(--blossom-pink);
  --color-earth: var(--earth-tan);
  
  --color-magenta: var(--magenta);
  --color-teal: var(--teal);
  --color-gold: var(--gold);
  --color-coral: var(--coral);
  --color-text-primary: var(--text-primary);
  --color-text-muted: var(--text-muted);
  
  --font-serif: var(--font-serif);
  --font-sans: var(--font-sans);
}
```

## Global Styles
```css
body {
  background: linear-gradient(135deg, var(--sage-light) 0%, var(--sage-medium) 100%);
  color: var(--text-primary);
  font-family: var(--font-sans);
  min-height: 100vh;
  margin: 0;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

.glass {
  background: var(--glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  box-shadow: 0 8px 32px rgba(45, 74, 62, 0.05);
  border-radius: 24px;
}
```

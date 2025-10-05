# Murphy's Laws

A comprehensive collection of Murphy's Laws, humorous observations about life's tendency for things to go wrong at the worst possible moment. This project preserves and organizes the wisdom of Murphy's Laws and its many variations, submitted by people from around the world.

## About Murphy's Laws

Murphy's Law states: **"If anything can go wrong, it will."** This fundamental law was named after Captain Edward A. Murphy, an engineer working on Air Force Project MX981 in 1949 at Edwards Air Force Base. What started as a simple observation has evolved into a vast collection of life's ironies and inevitable mishaps.

## Features

### Categorized Laws Collection
Over 40 specialized categories covering every aspect of life:
- **Technology**: Computers, phones, printers, and digital devices
- **Transportation**: Cars, buses, airplanes, and public transport
- **Workplace**: Office life, employees, bosses, and meetings
- **Personal Life**: Love, family, toddlers, and daily activities
- **Specialized Fields**: Medical, military, education, sports, and more

### Sod's Law Calculator
An interactive web application that calculates the probability of things going wrong using the official British Gas formula:

**Formula**: `((U+C+I) × (10-S))/20 × A × 1/(1-sin(F/10))`

Where:
- **U** = Urgency (1-9)
- **C** = Complexity (1-9) 
- **I** = Importance (1-9)
- **S** = Skill level (1-9)
- **F** = Frequency (1-9)
- **A** = Activity factor (constant: 0.7)

### Real-Life Stories
A collection of user-submitted stories demonstrating Murphy's Laws in action, including philosophical debates about the nature of these universal truths.

## Origin Story

This collection began in the late 1990s when Raanan Avidor, a science fiction enthusiast inspired by Larry Niven's references to Murphy's Law, started a simple homepage on Geocities. After posting a personal Murphy's Law experience, emails started pouring in from people around the world sharing their own stories and laws. 

What started as a learning exercise in HTML became a comprehensive archive of life's inevitable ironies, demonstrating that Murphy's Law truly is universal.

## The Great Debate: Murphy's Law vs. Faith

The collection includes a fascinating philosophical debate between various readers about whether Murphy's Laws conflict with religious beliefs. This discussion showcases different perspectives on fatalism, optimism, and the role of humor in coping with life's challenges.

## Development

### Database Changes

⚠️ **IMPORTANT**: Never commit `murphys.db` directly! This file contains production user data.

To make database schema changes, use the migration system:

```bash
# 1. Create a migration file
cat > migrations/002_my_change.sql << 'EOF'
ALTER TABLE laws ADD COLUMN my_column TEXT;
EOF

# 2. Test locally
npm run migrate

# 3. Commit and deploy
git add migrations/002_my_change.sql
git commit -m "feat: Add my_column to laws"
git push
```

**See [DATABASE.md](./DATABASE.md) for complete documentation.**

A git hook will prevent you from accidentally committing the database file.

## Contributing

This is a living collection! This archive preserves the wisdom and humor for future generations. The laws demonstrate universal truths that transcend culture, profession, and time.

## License

This work is licensed under [CC0 1.0 Universal (CC0 1.0) Public Domain Dedication](https://creativecommons.org/publicdomain/zero/1.0/). You can copy, modify, and distribute this work, even for commercial purposes, without asking permission.

See the [LICENSE](LICENSE) file for full details.

## Core Murphy's Laws

Here are some essential laws to get you started:

- **The Original**: If anything can go wrong, it will.
- **The Corollary**: If anything just cannot go wrong, it will anyway.
- **The Timing Law**: If anything can go wrong, it will at the worst possible moment.
- **O'Toole's Commentary**: Murphy was an optimist!
- **The Bread Law**: The chance of bread falling butter-side down is directly proportional to the cost of the carpet.

## Why Murphy's Laws Matter

Murphy's Laws serve as:
- **Stress Relief**: Humor helps us cope with inevitable frustrations
- **Preparedness**: Expecting problems helps us plan better
- **Universal Truth**: These experiences are shared across all humanity
- **Perspective**: Sometimes laughing is better than crying

---

*Remember: Murphy's Law isn't about pessimism, it's about finding humor in life's inevitable chaos and being prepared for the unexpected. After all, if you're reading this README, something probably just went wrong that brought you here!* 😄

export interface Quote {
  text: string;
  author: string;
  category: 'Project Management' | 'Engineering' | 'Teamwork' | 'Productivity' | 'Safety' | 'Light Humor';
}

export const quotes: (Omit<Quote, 'category'> & { category: string })[] = [
  // 1-50: Leadership & Project Management
  { text: "Management is doing things right; leadership is doing the right things.", author: "Peter Drucker", category: "Leadership" },
  { text: "The first responsibility of a leader is to define reality. The last is to say thank you.", author: "Max De Pree", category: "Leadership" },
  { text: "Lead and inspire people. Don't try to manage and manipulate them.", author: "Stephen Covey", category: "Leadership" },
  { text: "Outstanding leaders go out of their way to boost the self-esteem of their personnel.", author: "Sam Walton", category: "Leadership" },
  { text: "A leader is best when people barely know he exists, when his work is done, his aim fulfilled, they will say: we did it ourselves.", author: "Lao Tzu", category: "Leadership" },
  { text: "Leadership and learning are indispensable to each other.", author: "John F. Kennedy", category: "Leadership" },
  { text: "Before you are a leader, success is all about growing yourself. When you become a leader, success is all about growing others.", author: "Jack Welch", category: "Leadership" },
  { text: "A genuine leader is not a searcher for consensus but a molder of consensus.", author: "Martin Luther King Jr.", category: "Leadership" },
  { text: "Control is not leadership; coaching is.", author: "Anonymous", category: "Leadership" },
  { text: "The greatest leader is not necessarily the one who does the greatest things. He is the one that gets the people to do the greatest things.", author: "Ronald Reagan", category: "Leadership" },
  { text: "Average leaders raise the bar on themselves; good leaders raise the bar for others; great leaders inspire others to raise their own bar.", author: "Orrin Woodward", category: "Leadership" },
  { text: "To handle yourself, use your head; to handle others, use your heart.", author: "Eleanor Roosevelt", category: "Leadership" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs", category: "Leadership" },
  { text: "Leadership is the capacity to translate vision into reality.", author: "Warren Bennis", category: "Leadership" },
  { text: "As we look ahead into the next century, leaders will be those who empower others.", author: "Bill Gates", category: "Leadership" },
  { text: "Do not follow where the path may lead. Go instead where there is no path and leave a trail.", author: "Ralph Waldo Emerson", category: "Leadership" },
  { text: "A good leader takes a little more than his share of the blame, a little less than his share of the credit.", author: "Arnold H. Glasow", category: "Leadership" },
  { text: "Great leaders are almost always great simplifiers, who can cut through argument, debate and doubt to offer a solution everybody can understand.", author: "Colin Powell", category: "Leadership" },
  { text: "High-performance leadership is not about a title; it is about building deep trust and capability.", author: "Anonymous", category: "Leadership" },
  { text: "The growth and development of people is the highest calling of leadership.", author: "Harvey S. Firestone", category: "Leadership" },
  { text: "Good plans shape good decisions. That's why good planning helps to make elusive dreams reality.", author: "Lester R. Bittel", category: "Project Management" },
  { text: "Project management is like juggling three balls - time, cost and quality.", author: "G. Reiss", category: "Project Management" },
  { text: "Operations keeps the lights on, strategy decides where the spotlights go, but project management makes it happen.", author: "Anonymous", category: "Project Management" },
  { text: "A project without a clear target is like a ship without a rudder.", author: "Anonymous", category: "Project Management" },
  { text: "Plan your work for today and every day, then work your plan.", author: "Margaret Thatcher", category: "Project Management" },
  { text: "Unless commitment is made, there are only promises and hopes; but no plans.", author: "Peter Drucker", category: "Project Management" },
  { text: "If you don't know where you are going, you'll end up somewhere else.", author: "Yogi Berra", category: "Project Management" },
  { text: "The key to successful project management is managing the risk, not just the tasks.", author: "Anonymous", category: "Project Management" },
  { text: "A goal without a plan is just a wish.", author: "Antoine de Saint-Exupéry", category: "Project Management" },
  { text: "First, have a definite, clear practical ideal; a goal, an objective. Second, have the necessary means to achieve your ends.", author: "Aristotle", category: "Project Management" },
  { text: "What we call results are just beginnings.", author: "Ralph Waldo Emerson", category: "Project Management" },
  { text: "Good planning without action is just a daydream. Action without planning is a nightmare.", author: "Japanese Proverb", category: "Project Management" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker", category: "Project Management" },
  { text: "Execution is everything. Plans are just intention.", author: "Jack Welch", category: "Project Management" },
  { text: "Expect the best, plan for the worst, and prepare to be surprised.", author: "Denis Waitley", category: "Project Management" },
  { text: "By failing to prepare, you are preparing to fail.", author: "Benjamin Franklin", category: "Project Management" },
  { text: "Efficiency is doing things right; effectiveness is doing the right things.", author: "Peter Drucker", category: "Project Management" },
  { text: "It is not the strongest of the species that survive, nor the most intelligent, but the one most responsive to change.", author: "Charles Darwin", category: "Project Management" },
  { text: "Focus on the critical path, but never ignore the people who walk it.", author: "Anonymous", category: "Project Management" },
  { text: "Plans are worthless, but planning is everything.", author: "Dwight D. Eisenhower", category: "Project Management" },
  { text: "Quality means doing it right when no one is looking.", author: "Henry Ford", category: "Project Management" },
  { text: "Most failures in projects come from lack of alignment, not lack of effort.", author: "Anonymous", category: "Project Management" },
  { text: "If everyone is moving forward together, then success takes care of itself.", author: "Henry Ford", category: "Project Management" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain", category: "Project Management" },
  { text: "Productivity is being able to do things that you were never able to do before.", author: "Franz Kafka", category: "Project Management" },
  { text: "Great projects are not built by chance; they are built by design.", author: "Anonymous", category: "Project Management" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso", category: "Project Management" },
  { text: "Do not wait; the time will never be 'just right.' Start where you stand.", author: "George Herbert", category: "Project Management" },
  { text: "Aligning schedule, resources, and project scope is the key to perfect delivery.", author: "Anonymous", category: "Project Management" },
  { text: "He who has a clear 'why' can bear almost any 'how'.", author: "Friedrich Nietzsche", category: "Project Management" },

  // 51-100: Engineering & Architecture
  { text: "Scientists study the world as it is; engineers create the world that has never been.", author: "Theodore von Kármán", category: "Engineering" },
  { text: "Engineering is the art of directing the great sources of power in nature for the use and convenience of man.", author: "Thomas Tredgold", category: "Engineering" },
  { text: "The human foot is a masterpiece of engineering and a work of art.", author: "Leonardo da Vinci", category: "Engineering" },
  { text: "Software is a great combination between artistry and engineering.", author: "Bill Gates", category: "Engineering" },
  { text: "To the engineer, all matter in the universe is materials for creation.", author: "Anonymous", category: "Engineering" },
  { text: "Engineering is not merely knowing and being knowledgeable, like a walking encyclopedia; engineering is not merely analysis; engineering is the practicing of the art of the organizing forces.", author: "Arthur M. Wellington", category: "Engineering" },
  { text: "One man's 'magic' is another man's engineering.", author: "Robert A. Heinlein", category: "Engineering" },
  { text: "Strive for perfection in everything you do. Take the best that exists and make it better. When it does not exist, design it.", author: "Sir Henry Royce", category: "Engineering" },
  { text: "Architecture starts when you carefully put two bricks together. There it begins.", author: "Ludwig Mies van der Rohe", category: "Engineering" },
  { text: "Math is my Passion. Engineering is my Profession.", author: "Wilfred James Henn", category: "Engineering" },
  { text: "An engineer is someone who uses scientific knowledge to solve practical problems.", author: "Anonymous", category: "Engineering" },
  { text: "The scientist discovers a new type of material or energy and the engineer finds a use for it.", author: "Gordon Lindsay Glegg", category: "Engineering" },
  { text: "Engineering is the professional art of applying science to the optimum conversion of resources.", author: "Ralph J. Smith", category: "Engineering" },
  { text: "A good engineer thinks in terms of constraints, tradeoffs, and simple elegance.", author: "Anonymous", category: "Engineering" },
  { text: "The standard engineer's answer to any question is: It depends.", author: "Anonymous", category: "Engineering" },
  { text: "Design is not just what it looks like and feels like. Design is how it works.", author: "Steve Jobs", category: "Engineering" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci", category: "Engineering" },
  { text: "Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.", author: "Antoine de Saint-Exupéry", category: "Engineering" },
  { text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", author: "Martin Fowler", category: "Engineering" },
  { text: "Manufacturing is more than just putting parts together. It's coming up with ideas, testing principles and perfecting the engineering.", author: "James Dyson", category: "Engineering" },
  { text: "The ideal engineer is a composite. He is not a scientist, he is not a sociologist, he is not a writer; but he must utilize the work of all of these.", author: "Arthur M. Wellington", category: "Engineering" },
  { text: "Experience is the name everyone gives to their mistakes.", author: "Oscar Wilde", category: "Engineering" },
  { text: "Failure is simply the opportunity to begin again, this time more intelligently.", author: "Henry Ford", category: "Engineering" },
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson", category: "Engineering" },
  { text: "Simplicity is about subtracting the obvious and adding the meaningful.", author: "John Maeda", category: "Engineering" },
  { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds", category: "Engineering" },
  { text: "Make it simple, make it memorable, make it inviting to look at, make it fun to read.", author: "Leo Burnett", category: "Engineering" },
  { text: "The best design is the simplest design that works.", author: "Anonymous", category: "Engineering" },
  { text: "Good engineering is all about managing complexity with clean abstractions.", author: "Anonymous", category: "Engineering" },
  { text: "There is nothing so useless as doing efficiently that which should not be done at all.", author: "Peter Drucker", category: "Engineering" },
  { text: "Measuring programming progress by lines of code is like measuring aircraft building progress by weight.", author: "Bill Gates", category: "Engineering" },
  { text: "If you think good design is expensive, you should look at the cost of bad design.", author: "Ralf Speth", category: "Engineering" },
  { text: "A common mistake that people make when trying to design something completely foolproof is to underestimate the ingenuity of complete fools.", author: "Douglas Adams", category: "Engineering" },
  { text: "Code never lies, comments sometimes do.", author: "Ron Jeffries", category: "Engineering" },
  { text: "You can't solve a problem with the same mind that created it.", author: "Albert Einstein", category: "Engineering" },
  { text: "Debugging is twice as hard as writing the code in the first place.", author: "Brian Kernighan", category: "Engineering" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle", category: "Engineering" },
  { text: "A primary key is the cornerstone of database integrity.", author: "Anonymous", category: "Engineering" },
  { text: "A user interface is like a joke. If you have to explain it, it’s not that good.", author: "Anonymous", category: "Engineering" },
  { text: "In engineering, we don't guess. We measure, analyze, and test.", author: "Anonymous", category: "Engineering" },
  { text: "No system is completely safe, but good engineering makes failure highly improbable.", author: "Anonymous", category: "Engineering" },
  { text: "The best error message is the one that never shows up because the system works.", author: "Anonymous", category: "Engineering" },
  { text: "Design for the user first, and the machine will follow.", author: "Anonymous", category: "Engineering" },
  { text: "Automation is not to replace human wisdom, but to elevate it.", author: "Anonymous", category: "Engineering" },
  { text: "A computer is like a violin. You can play a beautiful tune or a screeching noise.", author: "Anonymous", category: "Engineering" },
  { text: "Great builders understand both the bricks and the blueprints.", author: "Anonymous", category: "Engineering" },
  { text: "Good architecture stands the test of time, weather, and user requests.", author: "Anonymous", category: "Engineering" },
  { text: "We construct our systems the way we construct our cities - block by block, module by module.", author: "Anonymous", category: "Engineering" },
  { text: "In software and structures, clean foundations lead to steady skyscrapers.", author: "Anonymous", category: "Engineering" },
  { text: "If it works, don't touch it - unless you have a unit test for it.", author: "Anonymous", category: "Engineering" },

  // 101-150: Teamwork & Collaboration
  { text: "Talent wins games, but teamwork and intelligence win championships.", author: "Michael Jordan", category: "Teamwork" },
  { text: "Alone we can do so little; together we can do so much.", author: "Helen Keller", category: "Teamwork" },
  { text: "Remember, teamwork begins by building trust. And the only way to do that is to overcome our need for invulnerability.", author: "Patrick Lencioni", category: "Teamwork" },
  { text: "None of us is as smart as all of us.", author: "Ken Blanchard", category: "Teamwork" },
  { text: "Coming together is a beginning. Keeping together is progress. Working together is success.", author: "Henry Ford", category: "Teamwork" },
  { text: "If you want to go fast, go alone. If you want to go far, go together.", author: "African Proverb", category: "Teamwork" },
  { text: "It is amazing what you can accomplish if you do not care who gets the credit.", author: "Harry S. Truman", category: "Teamwork" },
  { text: "Teamwork makes the dream work.", author: "John C. Maxwell", category: "Teamwork" },
  { text: "The strength of the team is each individual member. The strength of each member is the team.", author: "Phil Jackson", category: "Teamwork" },
  { text: "Politeness is the poison of collaboration.", author: "Edwin Land", category: "Teamwork" },
  { text: "Individual commitment to a group effort - that is what makes a team work, a company work, a society work, a civilization work.", author: "Vince Lombardi", category: "Teamwork" },
  { text: "No individual can win a game by himself.", author: "Pelé", category: "Teamwork" },
  { text: "Find a group of people who challenge and inspire you, spend a lot of time with them, and it will change your life.", author: "Amy Poehler", category: "Teamwork" },
  { text: "Synergy - the bonus that comes when things work together.", author: "Mark Twain", category: "Teamwork" },
  { text: "We may have all come on different ships, but we're in the same boat now.", author: "Martin Luther King Jr.", category: "Teamwork" },
  { text: "Great things in business are never done by one person. They're done by a team of people.", author: "Steve Jobs", category: "Teamwork" },
  { text: "Interdependence is a far more mature and advanced concept than independence.", author: "Stephen Covey", category: "Teamwork" },
  { text: "Collaboration is like playing in an orchestra. Everyone has a different instrument, but we play the same sheet music.", author: "Anonymous", category: "Teamwork" },
  { text: "A group becomes a team when each member is sure enough of himself and his contribution to praise the skills of others.", author: "Norman Shidle", category: "Teamwork" },
  { text: "The nice thing about teamwork is that you always have others on your side.", author: "Margaret Carty", category: "Teamwork" },
  { text: "Unity is strength... when there is teamwork and collaboration, wonderful things can be achieved.", author: "Mattie Stepanek", category: "Teamwork" },
  { text: "None of us, including me, ever do great things. But we can all do small things, with great love, and together we can do something wonderful.", author: "Mother Teresa", category: "Teamwork" },
  { text: "It takes two flints to make a fire.", author: "Louisa May Alcott", category: "Teamwork" },
  { text: "Cooperation is the thorough conviction that nobody can get there unless everybody gets there.", author: "Virginia Burden", category: "Teamwork" },
  { text: "When your team is aligned, mountains become molehills.", author: "Anonymous", category: "Teamwork" },
  { text: "A single arrow is easily broken, but a bundle of ten is not.", author: "Japanese Proverb", category: "Teamwork" },
  { text: "The main ingredient of stardom is the rest of the team.", author: "John Wooden", category: "Teamwork" },
  { text: "We rise by lifting others.", author: "Robert Ingersoll", category: "Teamwork" },
  { text: "Effective teamwork is the bridge between project planning and project success.", author: "Anonymous", category: "Teamwork" },
  { text: "Trust is the glue of life. It’s the most essential ingredient in effective communication.", author: "Stephen Covey", category: "Teamwork" },
  { text: "A champion team will always defeat a team of champions.", author: "Anonymous", category: "Teamwork" },
  { text: "In a team, differences in opinion are not conflicts; they are design alternatives.", author: "Anonymous", category: "Teamwork" },
  { text: "Great collaboration starts with active listening and clear communication.", author: "Anonymous", category: "Teamwork" },
  { text: "No one can whistle a symphony. It takes a whole orchestra to play it.", author: "H.E. Luccock", category: "Teamwork" },
  { text: "We are all nodes in a grand network. The strength of the network is in the quality of the connections.", author: "Anonymous", category: "Teamwork" },
  { text: "A team that plays together, stays together, and delivers together.", author: "Anonymous", category: "Teamwork" },
  { text: "Great teams do not hide mistakes; they study them and improve.", author: "Anonymous", category: "Teamwork" },
  { text: "Building bridges is always better than building walls.", author: "Anonymous", category: "Teamwork" },
  { text: "We are stronger when we pull together in the same direction.", author: "Anonymous", category: "Teamwork" },
  { text: "The key to good alignment is a single source of truth.", author: "Anonymous", category: "Teamwork" },
  { text: "A solid standby roster is built on the foundation of supportive colleagues.", author: "Anonymous", category: "Teamwork" },
  { text: "Teamwork divides the task and multiplies the success.", author: "Anonymous", category: "Teamwork" },
  { text: "Our differences are our strengths. Together, we cover all bases.", author: "Anonymous", category: "Teamwork" },
  { text: "A group of people with a shared vision can achieve the impossible.", author: "Anonymous", category: "Teamwork" },
  { text: "True collaboration is about creating space for others to shine.", author: "Anonymous", category: "Teamwork" },
  { text: "Success is a shared journey, not a solo race.", author: "Anonymous", category: "Teamwork" },
  { text: "Good teams build products; great teams build trust.", author: "Anonymous", category: "Teamwork" },
  { text: "When we share knowledge, we double our power.", author: "Anonymous", category: "Teamwork" },
  { text: "A synchronized team turns project deadlines into project celebrations.", author: "Anonymous", category: "Teamwork" },
  { text: "The best teams are self-organizing, highly communicative, and relentlessly helpful.", author: "Anonymous", category: "Teamwork" },

  // 151-200: Productivity & Focus
  { text: "The best way to get started is to quit talking and begin doing.", author: "Walt Disney", category: "Productivity" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss", category: "Productivity" },
  { text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca", category: "Productivity" },
  { text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear", category: "Productivity" },
  { text: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King", category: "Productivity" },
  { text: "My goal is no longer to get more done, but rather to have less to do.", author: "Francine Jay", category: "Productivity" },
  { text: "Productivity is never an accident. It is always the result of a commitment to excellence, intelligent planning, and focused effort.", author: "Paul J. Meyer", category: "Productivity" },
  { text: "If you spend too much time thinking about a thing, you'll never get it done.", author: "Bruce Lee", category: "Productivity" },
  { text: "You can do anything, but you can't do everything.", author: "David Allen", category: "Productivity" },
  { text: "Start by doing what's necessary; then do what's possible; and suddenly you are doing the impossible.", author: "Francis of Assisi", category: "Productivity" },
  { text: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell", category: "Productivity" },
  { text: "Don't count the days, make the days count.", author: "Muhammad Ali", category: "Productivity" },
  { text: "If you have to eat two frogs, eat the ugliest one first.", author: "Mark Twain", category: "Productivity" },
  { text: "The simple act of writing down a task is the first step toward its completion.", author: "Anonymous", category: "Productivity" },
  { text: "Time is what we want most, but what we use worst.", author: "William Penn", category: "Productivity" },
  { text: "Work expands so as to fill the time available for its completion.", author: "Parkinson's Law", category: "Productivity" },
  { text: "Productivity is the deliberate reduction of friction in your daily work.", author: "Anonymous", category: "Productivity" },
  { text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: "Stephen Covey", category: "Productivity" },
  { text: "Simplicity is a great helper of productivity.", author: "Anonymous", category: "Productivity" },
  { text: "Tomorrow is the only day that appeals to a lazy man.", author: "Jimmy Lyons", category: "Productivity" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg", category: "Productivity" },
  { text: "You cannot manage time; you can only manage yourself.", author: "Anonymous", category: "Productivity" },
  { text: "To be disciplined is to choose between what you want now and what you want most.", author: "Anonymous", category: "Productivity" },
  { text: "Clutter is the enemy of clarity, and complexity is the enemy of execution.", author: "Anonymous", category: "Productivity" },
  { text: "A desk is a dangerous place from which to watch the world.", author: "John le Carré", category: "Productivity" },
  { text: "Plan tomorrow today. Your future self will thank you.", author: "Anonymous", category: "Productivity" },
  { text: "Deep work is the superpower of the 21st century.", author: "Cal Newport", category: "Productivity" },
  { text: "Multitasking is the opportunity to screw up more than one thing at a time.", author: "Anonymous", category: "Productivity" },
  { text: "If you don't design your day, someone else will design it for you.", author: "Anonymous", category: "Productivity" },
  { text: "Great results require both a sharp mind and a quiet workspace.", author: "Anonymous", category: "Productivity" },
  { text: "Your brain is for having ideas, not storing them.", author: "David Allen", category: "Productivity" },
  { text: "Small daily progress over time leads to stunning results.", author: "Robin Sharma", category: "Productivity" },
  { text: "The best productivity tool is a clear, distraction-free environment.", author: "Anonymous", category: "Productivity" },
  { text: "Batch your work, protect your time, and take breaks when needed.", author: "Anonymous", category: "Productivity" },
  { text: "Energy, not time, is the fundamental currency of high performance.", author: "Tony Schwartz", category: "Productivity" },
  { text: "Failing to document is failing to scale.", author: "Anonymous", category: "Productivity" },
  { text: "Consistency beats intensity every single time.", author: "Anonymous", category: "Productivity" },
  { text: "The most productive people are not the ones who work the longest, but the ones who work the smartest.", author: "Anonymous", category: "Productivity" },
  { text: "Define your boundary lines, protect your schedule, and focus on one task.", author: "Anonymous", category: "Productivity" },
  { text: "Progress is made in small increments. Write one line, test one module, ship one feature.", author: "Anonymous", category: "Productivity" },
  { text: "Keep a steady pace. Burnout is the enemy of long-term progress.", author: "Anonymous", category: "Productivity" },
  { text: "An ounce of prevention is worth a pound of cure.", author: "Benjamin Franklin", category: "Productivity" },
  { text: "Organize your workstation, align your schedule, and execute your tasks.", author: "Anonymous", category: "Productivity" },
  { text: "What gets measured gets managed.", author: "Peter Drucker", category: "Productivity" },
  { text: "Automate the repetitive, delegate the simple, and focus on the complex.", author: "Anonymous", category: "Productivity" },
  { text: "A minute of planning saves an hour of execution.", author: "Anonymous", category: "Productivity" },
  { text: "Eliminate distractions before they eliminate your day.", author: "Anonymous", category: "Productivity" },
  { text: "Focus is a muscle. Train it every day.", author: "Anonymous", category: "Productivity" },
  { text: "Great work takes time, patience, and deliberate effort.", author: "Anonymous", category: "Productivity" },
  { text: "Simplify, simplify, simplify.", author: "Henry David Thoreau", category: "Productivity" },

  // 201-250: Safety & Workplace Standards
  { text: "Safety is not an intellectual exercise to keep us in work. It is a matter of life and death.", author: "Sir John Harvey-Jones", category: "Safety" },
  { text: "Safety is something that happens between your ears, not something you hold in your hands.", author: "Jeff Cooper", category: "Safety" },
  { text: "Prepare and prevent, don't repair and repent.", author: "Ezra Taft Benson", category: "Safety" },
  { text: "Safety isn't expensive, it's priceless.", author: "Anonymous", category: "Safety" },
  { text: "An accident is something that happens when you least expect it, due to a safety check you forgot.", author: "Anonymous", category: "Safety" },
  { text: "Your family awaits you at home. Work safely today.", author: "Anonymous", category: "Safety" },
  { text: "Safety is a state of mind. Accident is an absence of mind.", author: "Anonymous", category: "Safety" },
  { text: "The door to safety swings on the hinges of common sense.", author: "Anonymous", category: "Safety" },
  { text: "Never compromise safety for speed, schedule, or cost.", author: "Anonymous", category: "Safety" },
  { text: "At the end of the day, the best metric is that everyone goes home safely.", author: "Anonymous", category: "Safety" },
  { text: "Safety is a cheap insurance policy for your future.", author: "Anonymous", category: "Safety" },
  { text: "Safety does not come by accident. It is built by design.", author: "Anonymous", category: "Safety" },
  { text: "Better a thousand times careful than once dead.", author: "Proverb", category: "Safety" },
  { text: "Safety is a continuous journey, not a final destination.", author: "Anonymous", category: "Safety" },
  { text: "To work safely is to show respect for yourself, your family, and your team.", author: "Anonymous", category: "Safety" },
  { text: "The key to safety is identifying the hazard before it identifies you.", author: "Anonymous", category: "Safety" },
  { text: "Safety is not a checklist. It is a core value.", author: "Anonymous", category: "Safety" },
  { text: "Carefulness costs you nothing. Negligence could cost you your life.", author: "Anonymous", category: "Safety" },
  { text: "Check your tools, wear your gear, and look out for your colleagues.", author: "Anonymous", category: "Safety" },
  { text: "Safety is the engine. Quality is the body. Delivery is the driver.", author: "Anonymous", category: "Safety" },
  { text: "A safe workplace is a productive workplace.", author: "Anonymous", category: "Safety" },
  { text: "If you see something unsafe, say something immediately.", author: "Anonymous", category: "Safety" },
  { text: "Precaution is better than cure.", author: "Edward Coke", category: "Safety" },
  { text: "Safety starts with S, but begins with YOU.", author: "Anonymous", category: "Safety" },
  { text: "Do not let a shortcut become your dead end.", author: "Anonymous", category: "Safety" },
  { text: "A clean site is a safe site.", author: "Anonymous", category: "Safety" },
  { text: "An ounce of prevention is worth a ton of incident reports.", author: "Anonymous", category: "Safety" },
  { text: "Expect the unexpected and plan for safe execution.", author: "Anonymous", category: "Safety" },
  { text: "Work safe, go home safe, live safe.", author: "Anonymous", category: "Safety" },
  { text: "Safety is not about rules; it is about respecting human life.", author: "Anonymous", category: "Safety" },
  { text: "Invest in safety, secure your future.", author: "Anonymous", category: "Safety" },
  { text: "The best safety device is a careful worker.", author: "Anonymous", category: "Safety" },
  { text: "Zero incidents is not a dream; it is our daily commitment.", author: "Anonymous", category: "Safety" },
  { text: "Alert today. Alive tomorrow.", author: "Anonymous", category: "Safety" },
  { text: "One careless moment can disrupt months of successful project work.", author: "Anonymous", category: "Safety" },
  { text: "Keep emergency exits clear, safety gear on, and mind active.", author: "Anonymous", category: "Safety" },
  { text: "Take five minutes to assess the risk before starting any physical work.", author: "Anonymous", category: "Safety" },
  { text: "Safety procedures are written in experience. Follow them carefully.", author: "Anonymous", category: "Safety" },
  { text: "Keep safety in mind, and you will leave hazards behind.", author: "Anonymous", category: "Safety" },
  { text: "Do not test the depth of the river with both feet.", author: "African Proverb", category: "Safety" },
  { text: "The first rule of engineering: Make it safe. The second rule: Make it work.", author: "Anonymous", category: "Safety" },
  { text: "Your safety gear is your shield. Wear it with pride.", author: "Anonymous", category: "Safety" },
  { text: "Think safety first, work safety always.", author: "Anonymous", category: "Safety" },
  { text: "We care for our team. Safety is non-negotiable.", author: "Anonymous", category: "Safety" },
  { text: "A minor hazard ignored is a major incident invited.", author: "Anonymous", category: "Safety" },
  { text: "Protect your hands, protect your eyes, protect your life.", author: "Anonymous", category: "Safety" },
  { text: "Safety is the cornerstone of engineering excellence.", author: "Anonymous", category: "Safety" },
  { text: "Look twice, cut once, and wear your hard hat.", author: "Anonymous", category: "Safety" },
  { text: "Be safety conscious, stay accident free.", author: "Anonymous", category: "Safety" },
  { text: "The most important tool in any toolbox is your brain. Use it safely.", author: "Anonymous", category: "Safety" },

  // 251-300: Workplace Humor & Light-hearted Quotes
  { text: "There are two ways to write error-free programs; only the third one works.", author: "Alan J. Perlis", category: "Light Humor" },
  { text: "To err is human, but to really foul things up you need a computer.", author: "Paul R. Ehrlich", category: "Light Humor" },
  { text: "If at first you don't succeed, call it version 1.0.", author: "Anonymous", category: "Light Humor" },
  { text: "A computer lets you make more mistakes faster than any invention in human history, with the possible exceptions of handguns and tequila.", author: "Mitch Radcliffe", category: "Light Humor" },
  { text: "Hard work never killed anybody, but why take the chance?", author: "Edgar Bergen", category: "Light Humor" },
  { text: "Work is the greatest thing in the world, so we should always save some of it for tomorrow.", author: "Don Herold", category: "Light Humor" },
  { text: "An expert is a person who has made all the mistakes that can be made in a very narrow field.", author: "Niels Bohr", category: "Light Humor" },
  { text: "Nothing is impossible for the man who doesn't have to do it himself.", author: "A.H. Weiler", category: "Light Humor" },
  { text: "I choose a lazy person to do a hard job. Because a lazy person will find an easy way to do it.", author: "Bill Gates", category: "Light Humor" },
  { text: "Before software can be reusable it first has to be usable.", author: "Ralph Johnson", category: "Light Humor" },
  { text: "The first 90% of the code accounts for the first 90% of the development time. The remaining 10% of the code accounts for the other 90% of the development time.", author: "Tom Cargill", category: "Light Humor" },
  { text: "My keyboard must be broken because I keep hitting the spacebar but I'm still on Earth.", author: "Anonymous", category: "Light Humor" },
  { text: "I love deadlines. I love the whooshing noise they make as they go by.", author: "Douglas Adams", category: "Light Humor" },
  { text: "If you think your boss is stupid, remember: you wouldn't have a job if he was any smarter.", author: "John Harrigan", category: "Light Humor" },
  { text: "Meetings: where minutes are kept and hours are lost.", author: "Anonymous", category: "Light Humor" },
  { text: "There are 10 types of people in this world: those who understand binary, and those who don't.", author: "Anonymous", category: "Light Humor" },
  { text: "Why do we never have time to do it right, but always have time to do it over?", author: "Anonymous", category: "Light Humor" },
  { text: "Computers are good at following instructions, but not at reading your mind.", author: "Donald Knuth", category: "Light Humor" },
  { text: "Coffee: the cognitive engine of engineering.", author: "Anonymous", category: "Light Humor" },
  { text: "My desk is not messy; it is just a high-entropy sorting system.", author: "Anonymous", category: "Light Humor" },
  { text: "In database design, normal forms are like speed limits. Good to know, but sometimes ignored for speed.", author: "Anonymous", category: "Light Humor" },
  { text: "A bug is not a mistake; it is an undocumented feature seeking attention.", author: "Anonymous", category: "Light Humor" },
  { text: "Doing nothing is very hard to do... you never know when you're finished.", author: "Leslie Nielsen", category: "Light Humor" },
  { text: "Tell me what you need, and I will explain how you can live without it.", author: "Dilbert", category: "Light Humor" },
  { text: "The clean desk policy is a conspiracy by people who don't actually do any paperwork.", author: "Anonymous", category: "Light Humor" },
  { text: "Standby duty is like fishing. Most of the time you are just waiting for a bite.", author: "Anonymous", category: "Light Humor" },
  { text: "I have too much workload to worry about how much workload I have.", author: "Anonymous", category: "Light Humor" },
  { text: "Vite is fast, but my clock when Friday afternoon comes is still slow.", author: "Anonymous", category: "Light Humor" },
  { text: "Ctrl + Z is the greatest invention since sliced bread.", author: "Anonymous", category: "Light Humor" },
  { text: "There is no Ctrl + Z in physical construction work. Measure thrice, cut once.", author: "Anonymous", category: "Light Humor" },

  // 301-365: Continuing Premium workplace and leadership quotes to reach 365
  { text: "Focus is a matter of deciding what things you're not going to do.", author: "John Carmack", category: "Productivity" },
  { text: "The best way to escape from a problem is to solve it.", author: "Alan Saporta", category: "Engineering" },
  { text: "Great builders are always curious about how things work under the hood.", author: "Anonymous", category: "Engineering" },
  { text: "If you cannot explain it simply, you do not understand it well enough.", author: "Albert Einstein", category: "Leadership" },
  { text: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein", category: "Motivational" as any },
  { text: "Quality is remembered long after the price is forgotten.", author: "Gucci Family", category: "Engineering" },
  { text: "Leadership is not about a title; it is about building deep trust and capability.", author: "Robin Sharma", category: "Leadership" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier", category: "Productivity" },
  { text: "A database with no indexes is like a book with no table of contents.", author: "Anonymous", category: "Engineering" },
  { text: "Every designer needs a feedback loop to improve.", author: "Steve Jobs", category: "Engineering" },
  { text: "The details are not the details. They make the design.", author: "Charles Eames", category: "Engineering" },
  { text: "You can use an eraser on the drafting table or a sledgehammer on the construction site.", author: "Frank Lloyd Wright", category: "Engineering" },
  { text: "Complexity is your enemy. Any fool can make something complicated. It is hard to keep things simple.", author: "Richard Branson", category: "Engineering" },
  { text: "There is nothing so useless as doing efficiently that which should not be done at all.", author: "Peter Drucker", category: "Productivity" },
  { text: "Good design is obvious. Great design is transparent.", author: "Joe Sparano", category: "Engineering" },
  { text: "Stated simply, teamwork is the fuel that allows common people to attain uncommon results.", author: "Andrew Carnegie", category: "Teamwork" },
  { text: "No legacy is so rich as honesty.", author: "William Shakespeare", category: "Leadership" },
  { text: "The primary asset of any project is its people.", author: "Anonymous", category: "Project Management" },
  { text: "To lead people, walk behind them.", author: "Lao Tzu", category: "Leadership" },
  { text: "The secret to productivity is a well-managed standby list.", author: "Anonymous", category: "Productivity" },
  { text: "We shape our buildings; thereafter they shape us.", author: "Winston Churchill", category: "Engineering" },
  { text: "Architecture is the learned game, correct and magnificent, of forms assembled in the light.", author: "Le Corbusier", category: "Engineering" },
  { text: "Drawings are the language of the engineer.", author: "Anonymous", category: "Engineering" },
  { text: "The world is moving so fast these days that the man who says it can't be done is generally interrupted by someone doing it.", author: "Elbert Hubbard", category: "Motivational" as any },
  { text: "Be slow to promise and quick to perform.", author: "Benjamin Franklin", category: "Leadership" },
  { text: "The shortest distance between two points is a straight line, but the most interesting is the critical path.", author: "Anonymous", category: "Project Management" },
  { text: "A project manager is like a conductor of an orchestra; his goal is harmony.", author: "Anonymous", category: "Project Management" },
  { text: "Management is efficiency in climbing the ladder of success; leadership determines whether the ladder is leaning against the right wall.", author: "Stephen Covey", category: "Leadership" },
  { text: "Do not let what you cannot do interfere with what you can do.", author: "John Wooden", category: "Motivational" as any },
  { text: "Safety is not an after-thought. It is the first thought.", author: "Anonymous", category: "Safety" },
  { text: "Safety is the key to longevity in your career.", author: "Anonymous", category: "Safety" },
  { text: "Teamwork means that you never have to carry the load alone.", author: "Anonymous", category: "Teamwork" },
  { text: "We are all in this project together. Let's make it great.", author: "Anonymous", category: "Teamwork" },
  { text: "An elegant solution is one that solves multiple problems at once.", author: "Anonymous", category: "Engineering" },
  { text: "Productivity is being proud of what you completed today.", author: "Anonymous", category: "Productivity" },
  { text: "A clear timeline layout is a manager's best friend.", author: "Anonymous", category: "Project Management" },
  { text: "The best project managers are high in empathy and low in ego.", author: "Anonymous", category: "Project Management" },
  { text: "Great leaders do not create followers, they create more leaders.", author: "Tom Peters", category: "Leadership" },
  { text: "Simplicity is the key to building robust systems.", author: "Anonymous", category: "Engineering" },
  { text: "Measure the quality, manage the schedule, and support the team.", author: "Anonymous", category: "Project Management" },
  { text: "Nothing is particularly hard if you divide it into small jobs.", author: "Henry Ford", category: "Productivity" },
  { text: "A standby employee is like a backup generator - always ready to serve.", author: "Anonymous", category: "Light Humor" },
  { text: "To finish first, you must first finish.", author: "Rick Mears", category: "Productivity" },
  { text: "Good documentation is the love letter you write to your future self.", author: "Anonymous", category: "Engineering" },
  { text: "The best design is the one that requires the least amount of explanation.", author: "Anonymous", category: "Engineering" },
  { text: "A clear remark in your sheet is worth ten phone calls.", author: "Anonymous", category: "Project Management" },
  { text: "Aligning schedules is the ultimate puzzle of workplace harmony.", author: "Anonymous", category: "Teamwork" },
  { text: "We build for eternity, but we manage day-by-day.", author: "Anonymous", category: "Project Management" },
  { text: "The future belongs to those who prepare for it today.", author: "Malcolm X", category: "Motivational" as any },
  { text: "A team aligned on project objectives is unstoppable.", author: "Anonymous", category: "Teamwork" },
  { text: "The key to good database design is consistency and normal forms.", author: "Anonymous", category: "Engineering" },
  { text: "Every incident is a lesson. Let's keep safety at zero incidents.", author: "Anonymous", category: "Safety" },
  { text: "Safety checks take seconds. Recoveries take months. Be careful.", author: "Anonymous", category: "Safety" },
  { text: "A solid team structure supports the weight of any project challenge.", author: "Anonymous", category: "Teamwork" },
  { text: "The secret to successful teamwork is trust, respect, and clear delegation.", author: "Anonymous", category: "Teamwork" },
  { text: "Do it right, do it once, and document it.", author: "Anonymous", category: "Productivity" },
  { text: "Success is a combination of design, determination, and delivery.", author: "Anonymous", category: "Motivational" as any },
  { text: "A messy code repository is like a dirty workshop. Clean it up.", author: "Anonymous", category: "Engineering" },
  { text: "Clean up your variables, align your imports, and test your code.", author: "Anonymous", category: "Engineering" },
  { text: "If everything seems under control, you're not going fast enough.", author: "Mario Andretti", category: "Light Humor" },
  { text: "A standby list is like a fire extinguisher. Hope you don't need it, but glad it's there.", author: "Anonymous", category: "Light Humor" },
  { text: "Excel sheets are the universal language of project managers.", author: "Anonymous", category: "Project Management" },
  { text: "Automation saves you from doing boring things, so you can do interesting mistakes.", author: "Anonymous", category: "Light Humor" },
  { text: "Keep moving forward. One step at a time, one row at a time.", author: "Anonymous", category: "Motivational" as any },
  { text: "A well-designed spreadsheet is a work of pure administrative art.", author: "Anonymous", category: "Project Management" }
];

export function getQuoteOfTheDay(): { quote: Quote; dateStr: string } {
  // Use local date instead of UTC to avoid timezone day shift!
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const dateVal = String(d.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${dateVal}`; // e.g. "2026-07-16"

  // 1. Get stored sequence
  let seqStr = localStorage.getItem('v2_quote_sequence');
  let seqIdxStr = localStorage.getItem('v2_quote_sequence_idx');
  let lastDate = localStorage.getItem('v2_quote_last_date');

  let sequence: number[] = [];
  let seqIdx = 0;

  if (seqStr) {
    try {
      sequence = JSON.parse(seqStr);
    } catch (e) {
      sequence = [];
    }
  }

  // If no sequence or corrupted, generate initial sequence [0..364]
  if (sequence.length !== quotes.length) {
    sequence = Array.from({ length: quotes.length }, (_, i) => i);
    // Shuffle it
    shuffleArray(sequence);
    localStorage.setItem('v2_quote_sequence', JSON.stringify(sequence));
  }

  if (seqIdxStr) {
    seqIdx = parseInt(seqIdxStr, 10);
    if (isNaN(seqIdx) || seqIdx < 0 || seqIdx >= quotes.length) {
      seqIdx = 0;
    }
  }

  // 2. If it's a new day, advance the quote sequence index
  if (lastDate !== todayStr) {
    if (lastDate !== null) {
      // It's a new day! Advance the index
      seqIdx += 1;

      // If exhausted all 365 quotes, reshuffle
      if (seqIdx >= quotes.length) {
        const lastQuoteId = sequence[quotes.length - 1];
        
        // Generate new sequence
        const newSequence = Array.from({ length: quotes.length }, (_, i) => i);
        shuffleArray(newSequence);

        // Make sure the first quote of the new cycle is not the same as the last quote of the old cycle
        if (newSequence[0] === lastQuoteId && quotes.length > 1) {
          // Swap the first and second item
          const temp = newSequence[0];
          newSequence[0] = newSequence[1];
          newSequence[1] = temp;
        }

        sequence = newSequence;
        seqIdx = 0;
        localStorage.setItem('v2_quote_sequence', JSON.stringify(sequence));
      }
    }

    // Save date and new index
    localStorage.setItem('v2_quote_last_date', todayStr);
    localStorage.setItem('v2_quote_sequence_idx', seqIdx.toString());
  }

  const quoteIndex = sequence[seqIdx];
  const rawQuote = quotes[quoteIndex] || quotes[0];
  const activeQuote: Quote = {
    text: rawQuote.text,
    author: rawQuote.author,
    category: ((rawQuote.category as string) === 'Leadership' ? 'Teamwork' : rawQuote.category) as Quote['category']
  };

  // Format today's date cleanly for presentation (e.g. 16-07-2026)
  const displayDate = `${dateVal}-${month}-${year}`;

  return {
    quote: activeQuote,
    dateStr: displayDate
  };
}

// Fisher-Yates Shuffle
function shuffleArray(array: number[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}


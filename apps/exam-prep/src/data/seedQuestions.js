// SAMPLE questions that ship with the app so every screen works on day one. Each has a worked explanation.
// These are a starter set, not a full bank: have a lecturer in each department review them, and grow the bank through
// the contribute flow (/contribute) and the owner review queue (/admin).
// Format: { t: question, o: [4 options], a: index of the correct option, e: explanation, topic }
import { SEED_MORE } from './seedMore.js';

const Q = (t, o, a, e, topic = '') => ({ t, o, a, e, topic });

const BASE = {
  'computer-science': [
    Q('What is the worst-case time complexity of binary search on a sorted array of n elements?', ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], 1, 'Each comparison halves the search range, so at most log2(n) comparisons are needed.', 'Algorithms'),
    Q('Which data structure follows the Last-In, First-Out (LIFO) principle?', ['Queue', 'Stack', 'Linked list', 'Binary tree'], 1, 'A stack adds and removes items at the same end (the top), so the last item pushed is the first popped.', 'Data structures'),
    Q('Which layer of the OSI model is mainly responsible for routing packets between networks?', ['Data link layer', 'Transport layer', 'Network layer', 'Session layer'], 2, 'The network layer (layer 3) uses logical addresses such as IP addresses to route packets across networks.', 'Networking'),
    Q('In SQL, which clause is used to filter groups after a GROUP BY has been applied?', ['WHERE', 'HAVING', 'ORDER BY', 'DISTINCT'], 1, 'WHERE filters individual rows before grouping; HAVING filters the groups produced by GROUP BY, for example on an aggregate such as COUNT(*).', 'Databases'),
    Q('Which CPU scheduling algorithm can cause starvation of long processes?', ['First-Come First-Served', 'Round Robin', 'Shortest Job First', 'None of them can'], 2, 'With Shortest Job First, a steady stream of short jobs can keep a long job waiting indefinitely. FCFS and Round Robin always give every process a turn.', 'Operating systems'),
    Q('How many edges does a complete undirected graph with n vertices have?', ['n', 'n(n - 1)/2', 'n^2', '2n'], 1, 'Every pair of vertices is joined by one edge, and the number of pairs is n choose 2 = n(n - 1)/2.', 'Discrete mathematics'),
    Q('A relation is in Second Normal Form (2NF) if it is in 1NF and has no ______ dependencies.', ['transitive', 'partial', 'multivalued', 'functional'], 1, '2NF removes partial dependencies: no non-key attribute may depend on only part of a composite candidate key.', 'Databases'),
    Q('Which of the following is a valid IPv4 address?', ['192.168.1.256', '10.0.0.1', '172.16.300.1', '1.2.3'], 1, 'An IPv4 address has four decimal numbers from 0 to 255 separated by dots. Only 10.0.0.1 meets that rule.', 'Networking'),
  ],
  'accounting-finance': [
    Q('Which equation is the basic accounting equation?', ['Assets = Liabilities - Equity', 'Assets = Liabilities + Owner\'s equity', 'Equity = Assets + Liabilities', 'Liabilities = Assets + Equity'], 1, 'Everything a business owns (assets) is financed either by outsiders (liabilities) or by the owner (equity): Assets = Liabilities + Owner\'s equity.', 'Fundamentals'),
    Q('Which of the following is a current asset?', ['Land', 'Cash', 'Building', 'Goodwill'], 1, 'Current assets are cash and items expected to be turned into cash within one year or one operating cycle. Land, buildings and goodwill are long-term assets.', 'Fundamentals'),
    Q('What is the normal balance of a revenue account?', ['Debit', 'Credit', 'Either, depending on the month', 'Revenue accounts have no normal balance'], 1, 'Revenue increases owner\'s equity, and equity increases with credits, so revenue accounts normally have credit balances.', 'Double entry'),
    Q('A business buys equipment on credit. What is the effect on the accounting equation?', ['Assets up, Liabilities down', 'Assets up, Liabilities up', 'Assets down, Equity up', 'No effect'], 1, 'Equipment (an asset) increases and Accounts Payable (a liability) increases by the same amount, so both sides of the equation rise equally.', 'Double entry'),
    Q('Equipment costs 50,000 birr, has a salvage value of 5,000 birr and a useful life of 5 years. What is the annual straight-line depreciation?', ['10,000 birr', '9,000 birr', '11,000 birr', '5,000 birr'], 1, 'Straight-line depreciation = (cost - salvage value) / useful life = (50,000 - 5,000) / 5 = 9,000 birr per year.', 'Depreciation'),
    Q('Which principle requires expenses to be recorded in the same period as the revenues they helped to earn?', ['Going concern', 'Matching principle', 'Materiality', 'Consistency'], 1, 'The matching principle links expenses to the revenue they generate so that profit for each period is measured fairly.', 'Principles'),
    Q('What is the main purpose of a trial balance?', ['To show the financial position of the business', 'To check that total debits equal total credits', 'To calculate net profit', 'To record transactions'], 1, 'A trial balance lists all ledger balances to test the arithmetic accuracy of double entry: total debits must equal total credits.', 'Double entry'),
    Q('How is gross profit calculated?', ['Net sales - Operating expenses', 'Net sales - Cost of goods sold', 'Net sales + Cost of goods sold', 'Revenue - Taxes'], 1, 'Gross profit = Net sales - Cost of goods sold. Operating expenses are deducted afterwards to reach operating profit.', 'Financial statements'),
  ],
  mathematics: [
    Q('What is the derivative of x^3 with respect to x?', ['x^2', '3x^2', '3x', 'x^3/3'], 1, 'By the power rule, d/dx of x^n is n x^(n-1), so d/dx of x^3 = 3x^2.', 'Calculus'),
    Q('Evaluate the integral of 2x dx.', ['x^2 + C', '2x^2 + C', 'x + C', '2 + C'], 0, 'The integral of x^n is x^(n+1)/(n+1), so the integral of 2x is 2 * x^2/2 = x^2, plus the constant C.', 'Calculus'),
    Q('What are the solutions of x^2 - 5x + 6 = 0?', ['x = 1 and x = 6', 'x = 2 and x = 3', 'x = -2 and x = -3', 'x = 5 and x = 6'], 1, 'Factor: x^2 - 5x + 6 = (x - 2)(x - 3). Setting each factor to zero gives x = 2 and x = 3.', 'Algebra'),
    Q('What is the determinant of the matrix [[2, 1], [3, 4]]?', ['5', '11', '8', '-5'], 0, 'For a 2x2 matrix [[a, b], [c, d]] the determinant is ad - bc = 2*4 - 1*3 = 5.', 'Linear algebra'),
    Q('What is the limit of sin(x)/x as x approaches 0?', ['0', '1', 'Infinity', 'It does not exist'], 1, 'This is a standard limit: sin(x)/x approaches 1 as x approaches 0 (it can be shown with the squeeze theorem).', 'Calculus'),
    Q('What is the sum of the interior angles of a hexagon?', ['540 degrees', '720 degrees', '900 degrees', '360 degrees'], 1, 'The sum of interior angles of an n-sided polygon is (n - 2) * 180 degrees. For n = 6 that is 4 * 180 = 720 degrees.', 'Geometry'),
    Q('In how many different ways can 4 distinct books be arranged on a shelf?', ['16', '24', '12', '4'], 1, 'The number of arrangements of 4 distinct objects is 4! = 4 * 3 * 2 * 1 = 24.', 'Combinatorics'),
    Q('What is the derivative of ln(x) for x > 0?', ['ln(x)/x', '1/x', 'x', 'e^x'], 1, 'The natural logarithm is the inverse of e^x, and its derivative is 1/x.', 'Calculus'),
  ],
};

// Every department's sample questions: the first three above plus the extra banks in seedMore.js.
export const SEED = { ...BASE, ...SEED_MORE };

"use strict";

// prisma/seed.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
async function main() {
  console.log("--- Starting Database Seeding ---");
  console.log("Seeding evaluation rubric...");
  const rubric = await prisma.rubric.upsert({
    where: { name: "DEFAULT_LLD_RUBRIC" },
    update: {},
    create: {
      name: "DEFAULT_LLD_RUBRIC",
      description: "Standard 100-point Low-Level Design evaluation rubric based on SOLID principles, modularity, and object-oriented design.",
      isDefault: true
    }
  });
  const criteriaData = [
    {
      name: "Requirement Understanding",
      description: "Identifies core functional requirements, scope boundaries, and realistic assumptions. Does not over-engineer or miss core capabilities.",
      maxScore: 15,
      orderIndex: 1
    },
    {
      name: "Class Responsibilities",
      description: "Single Responsibility Principle (SRP). Classes have coherent, focused responsibilities rather than god-objects doing everything.",
      maxScore: 20,
      orderIndex: 2
    },
    {
      name: "Encapsulation & Interfaces",
      description: "Exposes clear, minimal public contracts. Internal state is protected with appropriate access modifiers and interface segregation.",
      maxScore: 15,
      orderIndex: 3
    },
    {
      name: "Coupling & Cohesion",
      description: "Loose coupling between subsystems. High internal cohesion. Uses dependency injection/inversion where appropriate rather than tight concrete coupling.",
      maxScore: 15,
      orderIndex: 4
    },
    {
      name: "Abstraction / Design Patterns",
      description: "Applies appropriate design patterns (e.g. Strategy, State, Factory, Observer) deliberately where problems naturally warrant them, avoiding pattern bloat.",
      maxScore: 10,
      orderIndex: 5
    },
    {
      name: "Extensibility",
      description: "Open-Closed Principle (OCP). The design gracefully handles likely requirement changes (e.g. new vehicle types, payment methods, scheduling algorithms) without rewriting core logic.",
      maxScore: 15,
      orderIndex: 6
    },
    {
      name: "Edge Cases & Testability",
      description: "Considers concurrency, failure states, validation, boundaries, and whether components can be cleanly isolated for unit testing.",
      maxScore: 10,
      orderIndex: 7
    }
  ];
  for (const crit of criteriaData) {
    await prisma.rubricCriterion.upsert({
      where: {
        rubricId_name: {
          rubricId: rubric.id,
          name: crit.name
        }
      },
      update: {
        description: crit.description,
        maxScore: crit.maxScore,
        orderIndex: crit.orderIndex
      },
      create: {
        rubricId: rubric.id,
        name: crit.name,
        description: crit.description,
        maxScore: crit.maxScore,
        orderIndex: crit.orderIndex
      }
    });
  }
  console.log(`Seeded rubric with ${criteriaData.length} criteria (total score: 100).`);
  console.log("Seeding 4 LLD problems...");
  const problemsData = [
    {
      slug: "parking-lot",
      title: "Parking Lot",
      difficulty: "MEDIUM",
      description: "Design a multi-level parking lot system supporting multiple vehicle types, dynamic spot allocation, and fee calculation.",
      problemStatement: `Design an automated Parking Lot management system for a multi-floor facility. The system must coordinate vehicle entry, spot assignment, ticket generation, vehicle retrieval, and dynamic fee calculation across diverse vehicle categories.`,
      requirements: [
        "Support multiple vehicle types: Motorcycle, Car, Bus, and Electric Vehicle.",
        "Support corresponding parking spot types: Compact, Regular, Large, and EV-charging equipped spots.",
        "Support multi-floor layouts with designated spots per floor.",
        "Issue a time-stamped parking ticket upon vehicle entry if a suitable spot is available.",
        "Implement an allocation strategy (e.g., nearest to entrance, lowest floor first, or best-fit spot).",
        "Calculate parking fees upon exit based on elapsed duration and vehicle type pricing rules.",
        "Update real-time spot availability per floor and total facility capacity on vehicle entry/exit."
      ],
      constraints: [
        "A vehicle can only park in a spot of compatible size (e.g., a Bus requires a Large spot; a Car cannot take a Compact spot unless specified).",
        "Pricing rules may change over time (e.g., hourly flat rate vs tiered duration vs surge rates).",
        "System should handle concurrent entry/exit gates without race conditions on spot assignment."
      ]
    },
    {
      slug: "elevator-system",
      title: "Elevator System",
      difficulty: "HARD",
      description: "Design an elevator controller managing multiple elevator cars, dispatching algorithms, and floor requests.",
      problemStatement: `Design a centralized Elevator Controller for a modern high-rise building with multiple elevator cars. The system must process hall calls (up/down requests from floors) and internal car requests, selecting the optimal elevator car while ensuring passenger safety and throughput.`,
      requirements: [
        "Manage a bank of N elevator cars servicing M floors.",
        "Each elevator car tracks its current floor, direction of motion (UP, DOWN, IDLE), and door state (OPEN, CLOSED).",
        "Handle external hall calls (floor number + desired direction).",
        "Handle internal car requests (destination floor button pressed inside the car).",
        "Incorporate a pluggable elevator dispatching strategy (e.g., FCFS, LOOK / SCAN elevator algorithm, energy-saving mode).",
        "Handle emergency stop, overload warning, and maintenance modes per car."
      ],
      constraints: [
        "Elevators have maximum passenger weight and capacity constraints.",
        "Door operations must be safely synchronized with motion (never move while doors are open).",
        "Dispatching strategy should be easily swappable without altering car state machine logic."
      ]
    },
    {
      slug: "vending-machine",
      title: "Vending Machine",
      difficulty: "MEDIUM",
      description: "Design a state-driven vending machine supporting item selection, inventory management, multi-currency payment, and change return.",
      problemStatement: `Design a standalone automated Vending Machine software system. The machine must handle explicit user state transitions: selecting items from categorized racks, accepting payments in cash or card, dispensing products, and accurately calculating and returning change.`,
      requirements: [
        "Model the explicit states of the vending machine (e.g., Idle, ItemSelected, PaymentPending, Dispensing, OutOfStock).",
        "Manage an inventory of products organized in rows/slots with price and available quantity.",
        "Support multiple payment types: Cash (denominations of coins and bills) and Digital/Card payment.",
        "Calculate change required when cash payment exceeds the product price, validating machine change reserves.",
        "Allow user cancellation before dispensing, refunding any deposited amount.",
        "Admin maintenance mode to restock inventory and collect cash."
      ],
      constraints: [
        "State transitions must prevent invalid operations (e.g. cannot dispense without full payment; cannot select an out-of-stock item).",
        "Change return must handle insufficient machine reserve gracefully by alerting the user or refusing the transaction before charging."
      ]
    },
    {
      slug: "food-delivery",
      title: "Food Delivery",
      difficulty: "HARD",
      description: "Design an end-to-end food ordering and delivery coordination platform connecting customers, restaurants, and delivery partners.",
      problemStatement: `Design the core domain architecture for a Food Delivery Platform (e.g. Swiggy/DoorDash). The system manages the complete order lifecycle from cart creation and restaurant menu browsing to kitchen preparation, delivery driver matching, real-time status transitions, and payment settlement.`,
      requirements: [
        "Manage core actors: Customer, Restaurant Partner, Delivery Agent, and Admin.",
        "Model Restaurant menus, item customizations/addons, and real-time item availability.",
        "Model the Order lifecycle through explicit states: Placed, ConfirmedByRestaurant, Preparing, ReadyForPickup, PickedUp, Delivered, Cancelled.",
        "Driver assignment mechanism to match available delivery partners based on proximity and status.",
        "Support rating and review workflow for restaurants and delivery agents after completion.",
        "Support multiple payment methods and invoice generation."
      ],
      constraints: [
        "Cancellation policies depend on order state (e.g., cancellation free before kitchen starts preparing, penalty afterwards).",
        "Driver assignment strategy should be decoupled so it can support batching or zone-based matching in the future."
      ]
    }
  ];
  for (const prob of problemsData) {
    await prisma.problem.upsert({
      where: { slug: prob.slug },
      update: {
        title: prob.title,
        difficulty: prob.difficulty,
        description: prob.description,
        problemStatement: prob.problemStatement,
        requirements: prob.requirements,
        constraints: prob.constraints
      },
      create: prob
    });
  }
  console.log(`Successfully seeded ${problemsData.length} LLD problems.`);
  console.log("--- Database Seeding Complete ---");
}
main().catch((e) => {
  console.error("Error seeding database:", e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});

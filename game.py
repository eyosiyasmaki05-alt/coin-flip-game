import random
import secrets

class CoinFlipGame:
    def __init__(self):
        # Setting up the game based on your rules
        self.system_pool = 1000000
        self.player1_coins = 0
        self.player2_coins = 0
        self.p1_streak = 0
        self.p2_streak = 0
        self.target_to_win = 50  # First to 50 coins wins (You can change this!)

    def flip_coin(self):
        # CRITICAL: Using 'secrets' module ensures cryptographically secure randomness
        # This fulfills your "Fairness System" requirement so nobody can cheat or predict outcomes.
        return secrets.choice(["heads", "tails"])

    def play_round(self, p1_choice, p2_choice):
        if self.system_pool <= 0:
            print("The system pool is empty! Game Over.")
            return True

        # Lowercase the choices to prevent typos
        p1_choice = p1_choice.lower()
        p2_choice = p2_choice.lower()
        
        # Flip the coin
        result = self.flip_coin()
        print(f"\n--- The coin lands on: {result.upper()} ---")

        # Evaluate Player 1
        if p1_choice == result:
            self.player1_coins += 1
            self.system_pool -= 1
            self.p1_streak += 1
            print("Player 1 guessed CORRECT!")
            # Lucky Streak Bonus: 3 wins in a row = 10 extra coins
            if self.p1_streak >= 3:
                print("🔥 Player 1 is on a LUCKY STREAK! +10 bonus coins!")
                self.player1_coins += 10
                self.system_pool -= 10
        else:
            self.p1_streak = 0
            print("Player 1 guessed WRONG.")

        # Evaluate Player 2
        if p2_choice == result:
            self.player2_coins += 1
            self.system_pool -= 1
            self.p2_streak += 1
            print("Player 2 guessed CORRECT!")
            # Lucky Streak Bonus
            if self.p2_streak >= 3:
                print("🔥 Player 2 is on a LUCKY STREAK! +10 bonus coins!")
                self.player2_coins += 10
                self.system_pool -= 10
        else:
            self.p2_streak = 0
            print("Player 2 guessed WRONG.")

        # Print current standings
        print(f"Scores -> Player 1: {self.player1_coins} | Player 2: {self.player2_coins}")
        print(f"Remaining System Pool: {self.system_pool}")

        # Check for a winner
        if self.player1_coins >= self.target_to_win:
            print("\n🎉 PLAYER 1 WINS THE GAME! 🎉")
            return True
        elif self.player2_coins >= self.target_to_win:
            print("\n🎉 PLAYER 2 WINS THE GAME! 🎉")
            return True
        
        return False

# --- THIS RUNS THE GAME IN YOUR TERMINAL ---
if __name__ == "__main__":
    game = CoinFlipGame()
    print("Welcome to the Ultimate Coin Flip Game!")
    print(f"System Pool: {game.system_pool} coins. First to {game.target_to_win} wins!")
    
    game_over = False
    while not game_over:
        print("\nNew Round!")
        p1 = input("Player 1, choose heads or tails: ")
        p2 = input("Player 2, choose heads or tails: ")
        
        # Prevent invalid inputs
        if p1 not in ['heads', 'tails'] or p2 not in ['heads', 'tails']:
            print("Invalid choice! Please type 'heads' or 'tails'.")
            continue
            
        game_over = game.play_round(p1, p2)
